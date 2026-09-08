<?php
/**
 * Kleine Helfer: JSON-Antworten, Slug-Erzeugung, Anfrage-Daten, Dateinamen.
 */

declare(strict_types=1);

defined('FFK_APP') || exit;

/** Sendet eine JSON-Antwort und beendet die Anfrage. */
function ffk_json(mixed $data, int $status = 200): never
{
    if (!headers_sent()) {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
    }
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

/**
 * Erzeugt aus einem Text einen Slug (wie slugify() in server/routes.ts):
 * Kleinbuchstaben, deutsche Umlaute ausgeschrieben, nur a–z/0–9/Bindestrich.
 */
function ffk_slugify(string $s): string
{
    $s = mb_strtolower($s, 'UTF-8');
    $s = strtr($s, ['ä' => 'ae', 'ö' => 'oe', 'ü' => 'ue', 'ß' => 'ss']);
    $s = preg_replace('/[^a-z0-9]+/u', '-', $s) ?? '';
    $s = trim($s, '-');
    $s = mb_substr($s, 0, 80, 'UTF-8');
    return $s !== '' ? $s : 'beitrag';
}

/**
 * Säubert einen hochgeladenen Dateinamen (wie bisher in multer):
 * Unicode zerlegen, alles außer a–zA–Z0–9._- durch _ ersetzen.
 */
function ffk_safe_filename(string $name): string
{
    $name = basename($name);
    if (class_exists('Normalizer')) {
        $normalized = Normalizer::normalize($name, Normalizer::FORM_KD);
        if (is_string($normalized)) {
            $name = $normalized;
        }
    }
    $name = preg_replace('/[^a-zA-Z0-9._-]/', '_', $name) ?? '';
    $name = ltrim($name, '.'); // keine versteckten Dateien / Pfadtricks
    return $name !== '' ? mb_substr($name, 0, 150, 'UTF-8') : 'datei';
}

/** Eindeutiger Dateiname im Zielordner: <Zeitstempel-ms>_<sicherer Name>. */
function ffk_unique_filename(string $dir, string $originalName): string
{
    $safe = ffk_safe_filename($originalName);
    $stamp = (string) (int) round(microtime(true) * 1000);
    $candidate = $stamp . '_' . $safe;
    $i = 1;
    while (is_file($dir . '/' . $candidate)) {
        $candidate = $stamp . '-' . $i . '_' . $safe;
        $i++;
    }
    return $candidate;
}

/**
 * Eindeutiger Dateiname mit vorgegebener Endung. Der Namensstamm stammt aus dem
 * Browser-Dateinamen (nur zur Wiedererkennung), die Endung wird jedoch fest
 * vorgegeben – so kann ein Angreifer keine ausführbare Endung (.php) schmuggeln.
 */
function ffk_unique_filename_ext(string $dir, string $originalName, string $ext): string
{
    // Endung des Originalnamens abschneiden, Rest säubern
    $stem = preg_replace('/\.[^.]+$/', '', ffk_safe_filename($originalName)) ?? '';
    $stem = trim($stem, '._');
    if ($stem === '') {
        $stem = 'bild';
    }
    $stem = mb_substr($stem, 0, 100, 'UTF-8');
    $stamp = (string) (int) round(microtime(true) * 1000);
    $candidate = $stamp . '_' . $stem . '.' . $ext;
    $i = 1;
    while (is_file($dir . '/' . $candidate)) {
        $candidate = $stamp . '-' . $i . '_' . $stem . '.' . $ext;
        $i++;
    }
    return $candidate;
}

/** JSON-Body der Anfrage als Array (leer, wenn kein/ungültiges JSON). */
function ffk_body(): array
{
    static $cached = null;
    if ($cached !== null) {
        return $cached;
    }
    $raw = file_get_contents('php://input');
    if ($raw === false || $raw === '') {
        $cached = [];
        return $cached;
    }
    $decoded = json_decode($raw, true);
    $cached = is_array($decoded) ? $decoded : [];
    return $cached;
}

/** Query-Parameter als String (oder null, wenn nicht gesetzt/leer). */
function ffk_query(string $key): ?string
{
    $v = $_GET[$key] ?? null;
    if (!is_string($v) || $v === '') {
        return null;
    }
    return $v;
}

/**
 * Vereinheitlicht den Veröffentlichungs-Zeitstempel auf lokale Zeit
 * (Europe/Berlin) im Format Y-m-d\TH:i:s – genau wie die migrierten Beiträge.
 *
 * Warum: Der Editor schickt die Zeit als UTC (…Z). Würde man sie so speichern,
 * lägen in der Datenbank zwei Formate nebeneinander; die String-Sortierung und
 * der Jahresfilter (LIKE 'JJJJ-%') würden dann bei Einsätzen kurz nach
 * Mitternacht das falsche Jahr liefern, und jedes erneute Speichern eines
 * Beitrags verschöbe die Uhrzeit um die Zeitzonendifferenz. Durch die
 * Umrechnung auf Ortszeit stimmen Sortierung, Filter und das Bearbeiten-Feld.
 */
function ffk_normalize_published_at(string $value): string
{
    $value = trim($value);
    if ($value === '') {
        return $value;
    }
    $berlin = new DateTimeZone('Europe/Berlin');
    // Enthält der Wert eine Zeitzone (Z oder ±hh:mm), gilt sie; sonst als Ortszeit.
    $hasZone = (bool) preg_match('/(Z|[+-]\d{2}:?\d{2})$/', $value);
    try {
        $dt = new DateTimeImmutable($value, $hasZone ? new DateTimeZone('UTC') : $berlin);
    } catch (Exception $e) {
        return $value; // Im Zweifel unverändert lassen – lieber roh als kaputt.
    }
    return $dt->setTimezone($berlin)->format('Y-m-d\TH:i:s');
}

/** Aktueller Zeitstempel im ISO-Format (wie new Date().toISOString() in JS). */
function ffk_now_iso(): string
{
    return (new DateTimeImmutable('now', new DateTimeZone('UTC')))->format('Y-m-d\TH:i:s.v\Z');
}

/** Zeitstempel vor N Sekunden im ISO-Format. */
function ffk_iso_ago(int $seconds): string
{
    return (new DateTimeImmutable('now', new DateTimeZone('UTC')))
        ->modify('-' . $seconds . ' seconds')
        ->format('Y-m-d\TH:i:s.v\Z');
}

/**
 * IP-Adresse des Besuchers. Hinter dem Reverse-Proxy des Hosters steht die
 * echte Adresse in X-Forwarded-For (erster Eintrag).
 */
function ffk_client_ip(): string
{
    // X-Forwarded-For NUR auswerten, wenn in config.php ausdrücklich erlaubt.
    // Sonst könnte jeder den Header selbst setzen und damit das Anmelde-
    // Rate-Limit und die Besucherzählung aushebeln (der Header ist frei wählbar,
    // REMOTE_ADDR nicht). Auf dem Timme-Hosting spricht der Client direkt mit
    // dem Server – da ist REMOTE_ADDR korrekt und der Header darf ignoriert werden.
    if (ffk_config('trust_forwarded_for', false)) {
        $fwd = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? '';
        if (is_string($fwd) && $fwd !== '') {
            $first = trim(explode(',', $fwd)[0]);
            if ($first !== '' && filter_var($first, FILTER_VALIDATE_IP) !== false) {
                return $first;
            }
        }
    }
    $remote = $_SERVER['REMOTE_ADDR'] ?? '';
    return is_string($remote) ? $remote : '';
}

/** Bearer-Token aus dem Authorization-Header (oder null). */
function ffk_bearer_token(): ?string
{
    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
    if (!is_string($header) || $header === '') {
        // Manche FastCGI-Konfigurationen reichen den Header nur so durch
        if (function_exists('apache_request_headers')) {
            $all = apache_request_headers();
            foreach ($all as $k => $v) {
                if (strcasecmp($k, 'Authorization') === 0) {
                    $header = (string) $v;
                    break;
                }
            }
        }
    }
    if (!is_string($header) || stripos($header, 'Bearer ') !== 0) {
        return null;
    }
    $token = trim(substr($header, 7));
    return $token !== '' ? $token : null;
}

/** Wandelt einen Wert in einen Integer oder null (für optionale Zahlenfelder). */
function ffk_to_int_or_null(mixed $v): ?int
{
    if ($v === null || $v === '') {
        return null;
    }
    return (int) $v;
}

/** Wandelt einen Wert in eine Fließkommazahl oder null (lat/lng). */
function ffk_to_float_or_null(mixed $v): ?float
{
    if ($v === null || $v === '' || !is_numeric($v)) {
        return null;
    }
    return (float) $v;
}

/** Wandelt PHP-Größenangaben wie "32M" in Bytes um. */
function ffk_ini_bytes(string $value): int
{
    $value = trim($value);
    if ($value === '') {
        return 0;
    }
    $unit = strtolower($value[strlen($value) - 1]);
    $num = (int) $value;
    return match ($unit) {
        'g' => $num * 1024 * 1024 * 1024,
        'm' => $num * 1024 * 1024,
        'k' => $num * 1024,
        default => $num,
    };
}

/** Legt ein Verzeichnis an, falls es fehlt. */
function ffk_mkdir(string $dir): void
{
    if (!is_dir($dir)) {
        @mkdir($dir, 0775, true);
    }
}

/**
 * Prüft, ob ein Dateipfad wirklich innerhalb des erlaubten Verzeichnisses
 * liegt (Schutz vor "../"-Tricks in Dateinamen).
 */
function ffk_path_within(string $dir, string $path): bool
{
    $realDir = realpath($dir);
    $realPath = realpath($path);
    if ($realDir === false || $realPath === false) {
        return false;
    }
    return str_starts_with($realPath, $realDir . DIRECTORY_SEPARATOR) || $realPath === $realDir;
}
