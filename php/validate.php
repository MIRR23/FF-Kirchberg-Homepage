<?php
/**
 * Prüfung der Eingabedaten – ersetzt die bisherigen Zod-Schemas aus
 * shared/schema.ts. Unbekannte Felder werden ignoriert (wie zuvor bei Zod),
 * Fehlermeldungen sind deutsch.
 */

declare(strict_types=1);

defined('FFK_APP') || exit;

/** Ergebnis einer Prüfung: entweder Daten oder eine Fehlermeldung. */
final class FfkValidation
{
    public function __construct(
        public readonly array $data,
        public readonly ?string $error = null,
    ) {
    }

    public function ok(): bool
    {
        return $this->error === null;
    }
}

/** Beendet die Anfrage mit 400, wenn die Prüfung fehlgeschlagen ist. */
function ffk_validated(FfkValidation $v): array
{
    if (!$v->ok()) {
        ffk_fail(400, $v->error ?? 'Ungültige Daten');
    }
    return $v->data;
}

/**
 * Holt ein Textfeld aus dem Body.
 *
 * @param array{required?:bool,max?:int,nullable?:bool,default?:string} $opts
 */
function ffk_field_string(array $b, string $key, array &$out, array $opts = []): ?string
{
    $required = $opts['required'] ?? false;
    $nullable = $opts['nullable'] ?? false;

    if (!array_key_exists($key, $b)) {
        if ($required) {
            return "Das Feld „{$key}“ fehlt.";
        }
        if (array_key_exists('default', $opts)) {
            $out[$key] = $opts['default'];
        }
        return null;
    }
    $v = $b[$key];
    if ($v === null) {
        if (!$nullable) {
            return "Das Feld „{$key}“ darf nicht leer sein.";
        }
        $out[$key] = null;
        return null;
    }
    if (is_int($v) || is_float($v)) {
        $v = (string) $v;
    }
    if (!is_string($v)) {
        return "Das Feld „{$key}“ muss Text sein.";
    }
    if ($required && trim($v) === '') {
        return "Das Feld „{$key}“ darf nicht leer sein.";
    }
    if (isset($opts['max']) && mb_strlen($v, 'UTF-8') > $opts['max']) {
        return "Das Feld „{$key}“ ist zu lang (maximal {$opts['max']} Zeichen).";
    }
    $out[$key] = $v;
    return null;
}

/** Holt ein Ganzzahlfeld aus dem Body. */
function ffk_field_int(array $b, string $key, array &$out, array $opts = []): ?string
{
    $required = $opts['required'] ?? false;
    if (!array_key_exists($key, $b)) {
        if ($required) {
            return "Das Feld „{$key}“ fehlt.";
        }
        if (array_key_exists('default', $opts)) {
            $out[$key] = $opts['default'];
        }
        return null;
    }
    $v = $b[$key];
    if (!is_int($v) && !(is_string($v) && preg_match('/^-?\d+$/', $v) === 1) && !is_bool($v)) {
        return "Das Feld „{$key}“ muss eine Zahl sein.";
    }
    $n = (int) $v;
    if (isset($opts['min']) && $n < $opts['min']) {
        return "Das Feld „{$key}“ ist zu klein.";
    }
    if (isset($opts['max']) && $n > $opts['max']) {
        return "Das Feld „{$key}“ ist zu groß.";
    }
    $out[$key] = $n;
    return null;
}

/** Holt ein Fließkommafeld (lat/lng) aus dem Body; null ist erlaubt. */
function ffk_field_float_nullable(array $b, string $key, array &$out): ?string
{
    if (!array_key_exists($key, $b)) {
        return null;
    }
    $v = $b[$key];
    if ($v === null || $v === '') {
        $out[$key] = null;
        return null;
    }
    if (!is_numeric($v)) {
        return "Das Feld „{$key}“ muss eine Zahl sein.";
    }
    $out[$key] = (float) $v;
    return null;
}

/** Holt ein Auswahlfeld mit fester Werteliste. */
function ffk_field_enum(array $b, string $key, array $allowed, array &$out, array $opts = []): ?string
{
    if (!array_key_exists($key, $b)) {
        if ($opts['required'] ?? false) {
            return "Das Feld „{$key}“ fehlt.";
        }
        return null;
    }
    $v = $b[$key];
    if (!is_string($v) || !in_array($v, $allowed, true)) {
        return "Für „{$key}“ ist nur " . implode(' oder ', $allowed) . ' erlaubt.';
    }
    $out[$key] = $v;
    return null;
}

/** Holt ein Ja/Nein-Feld. */
function ffk_field_bool(array $b, string $key, array &$out): ?string
{
    if (!array_key_exists($key, $b)) {
        return null;
    }
    $v = $b[$key];
    if (!is_bool($v)) {
        return "Das Feld „{$key}“ muss ja oder nein sein.";
    }
    $out[$key] = $v;
    return null;
}

/** Führt eine Liste von Prüfungen aus und liefert das Ergebnis. */
function ffk_check(array $out, array $errors): FfkValidation
{
    foreach ($errors as $err) {
        if ($err !== null) {
            return new FfkValidation([], $err);
        }
    }
    return new FfkValidation($out);
}

// ---------------------------------------------------------------------------
// Entitäten
// ---------------------------------------------------------------------------

/** Beitrag (ohne slug – der wird serverseitig erzeugt und nie geändert). */
function ffk_validate_post(array $b, bool $partial): FfkValidation
{
    $out = [];
    $req = !$partial;
    $errors = [
        ffk_field_string($b, 'title', $out, ['required' => $req, 'max' => 500]),
        ffk_field_string($b, 'content', $out, ['default' => $partial ? null : '']),
        ffk_field_string($b, 'excerpt', $out, ['max' => 65000, 'default' => $partial ? null : '']),
        ffk_field_int($b, 'categoryId', $out, ['required' => $req, 'min' => 1]),
        ffk_field_string($b, 'publishedAt', $out, ['required' => $req, 'max' => 40]),
        ffk_field_string($b, 'featuredImage', $out, ['nullable' => true, 'max' => 500]),
        ffk_field_string($b, 'images', $out, ['default' => $partial ? null : '[]']),
        ffk_field_string($b, 'authorName', $out, ['max' => 255, 'default' => $partial ? null : '']),
        ffk_field_enum($b, 'status', ['published', 'draft'], $out),
        ffk_field_string($b, 'stichwort', $out, ['nullable' => true, 'max' => 255]),
        ffk_field_string($b, 'ort', $out, ['nullable' => true, 'max' => 255]),
        ffk_field_float_nullable($b, 'lat', $out),
        ffk_field_float_nullable($b, 'lng', $out),
    ];
    // Defaults nur beim Anlegen setzen, bei PATCH keine Felder erfinden
    if ($partial) {
        $out = array_filter($out, static fn ($v, $k) => array_key_exists($k, $b), ARRAY_FILTER_USE_BOTH);
    }
    return ffk_check($out, $errors);
}

/** Termin. */
function ffk_validate_event(array $b, bool $partial): FfkValidation
{
    $out = [];
    $req = !$partial;
    $errors = [
        ffk_field_string($b, 'title', $out, ['required' => $req, 'max' => 500]),
        ffk_field_string($b, 'date', $out, ['required' => $req, 'max' => 20]),
        ffk_field_string($b, 'time', $out, ['max' => 20, 'default' => $partial ? null : '']),
        ffk_field_string($b, 'location', $out, ['max' => 500, 'default' => $partial ? null : '']),
        ffk_field_string($b, 'description', $out, ['max' => 65000, 'default' => $partial ? null : '']),
        ffk_field_enum($b, 'kind', ['veranstaltung', 'uebung'], $out),
        ffk_field_float_nullable($b, 'lat', $out),
        ffk_field_float_nullable($b, 'lng', $out),
    ];
    if (!$partial && !array_key_exists('kind', $out)) {
        $out['kind'] = 'veranstaltung';
    }
    if ($partial) {
        $out = array_filter($out, static fn ($v, $k) => array_key_exists($k, $b), ARRAY_FILTER_USE_BOTH);
    }
    return ffk_check($out, $errors);
}

/** Fahrzeug. */
function ffk_validate_vehicle(array $b, bool $partial): FfkValidation
{
    $out = [];
    $req = !$partial;
    $errors = [
        ffk_field_string($b, 'name', $out, ['required' => $req, 'max' => 255]),
        ffk_field_string($b, 'type', $out, ['max' => 255, 'default' => $partial ? null : '']),
        ffk_field_string($b, 'description', $out, ['default' => $partial ? null : '']),
        ffk_field_string($b, 'image', $out, ['nullable' => true, 'max' => 500]),
        ffk_field_string($b, 'images', $out, ['default' => $partial ? null : '[]']),
        ffk_field_int($b, 'sortOrder', $out, ['default' => $partial ? null : 0]),
    ];
    if ($partial) {
        $out = array_filter($out, static fn ($v, $k) => array_key_exists($k, $b), ARRAY_FILTER_USE_BOTH);
    }
    return ffk_check($out, $errors);
}

/** Mitglied. */
function ffk_validate_member(array $b, bool $partial): FfkValidation
{
    $out = [];
    $req = !$partial;
    $errors = [
        ffk_field_string($b, 'name', $out, ['required' => $req, 'max' => 255]),
        ffk_field_string($b, 'funktion', $out, ['max' => 255, 'default' => $partial ? null : '']),
        ffk_field_enum($b, 'gruppe', ['vorstandschaft', 'aktive'], $out),
        ffk_field_string($b, 'image', $out, ['nullable' => true, 'max' => 500]),
        ffk_field_int($b, 'sortOrder', $out, ['default' => $partial ? null : 0]),
    ];
    if (!$partial && !array_key_exists('gruppe', $out)) {
        $out['gruppe'] = 'aktive';
    }
    if ($partial) {
        $out = array_filter($out, static fn ($v, $k) => array_key_exists($k, $b), ARRAY_FILTER_USE_BOTH);
    }
    return ffk_check($out, $errors);
}

/** Seite (ohne slug – Seiten werden fest über ihren Slug verlinkt). */
function ffk_validate_page(array $b): FfkValidation
{
    $out = [];
    $errors = [
        ffk_field_string($b, 'title', $out, ['max' => 255]),
        ffk_field_string($b, 'content', $out),
    ];
    $out = array_filter($out, static fn ($v, $k) => array_key_exists($k, $b), ARRAY_FILTER_USE_BOTH);
    return ffk_check($out, $errors);
}

/** Hero-Einstellungen der Startseite (Teilaktualisierung). */
function ffk_validate_hero(array $b): FfkValidation
{
    $out = [];
    $errors = [
        ffk_field_enum($b, 'mode', ['auto', 'custom'], $out),
        ffk_field_string($b, 'image', $out, ['nullable' => true, 'max' => 500]),
        ffk_field_enum($b, 'fit', ['cover', 'contain'], $out),
        ffk_field_int($b, 'overlay', $out, ['min' => 0, 'max' => 100]),
        ffk_field_string($b, 'title', $out, ['max' => 200]),
        ffk_field_string($b, 'intro', $out, ['max' => 1000]),
        ffk_field_string($b, 'alt', $out, ['max' => 300]),
    ];
    $out = array_filter($out, static fn ($v, $k) => array_key_exists($k, $b), ARRAY_FILTER_USE_BOTH);
    return ffk_check($out, $errors);
}

/** Allgemeine Website-Einstellungen (Teilaktualisierung). */
function ffk_validate_site(array $b): FfkValidation
{
    $out = [];
    $errors = [ffk_field_bool($b, 'linksNewTab', $out)];
    return ffk_check($out, $errors);
}
