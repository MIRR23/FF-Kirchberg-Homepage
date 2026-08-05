<?php
/**
 * Erstbefüllung der Datenbank – Portierung von server/migrate.ts.
 *
 * Übernimmt die Inhalte der alten WordPress-Website (ff-kirchberg.de) aus den
 * mitgelieferten JSON-Exporten in migration-data/json/ und verknüpft sie mit
 * den ebenfalls mitgelieferten Bildern in uploads/wp/.
 *
 * Der Ablauf startet automatisch beim ersten Aufruf der Website, solange noch
 * kein einziger Benutzer existiert („Dateien hochladen + config.php ausfüllen"
 * genügt als Installation). Bestehende Daten bleiben unangetastet.
 */

declare(strict_types=1);

defined('FFK_APP') || exit;

require_once __DIR__ . '/content.php';
require_once __DIR__ . '/images.php';

/** Die Bilder in uploads/ sind noch nicht vollständig auf dem Server. */
final class FfkIncompleteMediaException extends RuntimeException
{
}

/** Quellordner der WordPress-Exporte. */
function ffk_migration_src(): string
{
    return FFK_ROOT . '/migration-data';
}

/** Zielordner der migrierten Bilder. */
function ffk_migration_uploads(): string
{
    return FFK_UPLOAD_DIR . '/wp';
}

/**
 * Stellt sicher, dass die Installation vollständig ist. Läuft einmalig und
 * merkt sich das Ergebnis in den Einstellungen, damit spätere Anfragen nicht
 * belastet werden.
 */
function ffk_ensure_installed(): void
{
    // Steht in config.php ein Text statt true/false (z. B. 'neu'), werden die
    // Inhalte einmalig neu eingelesen – praktisch, wenn beim ersten Aufruf
    // noch nicht alle Bilder auf dem Server lagen. Der Wert darf danach
    // stehen bleiben; erst ein anderer Text löst ein weiteres Einlesen aus.
    $mode = ffk_config('auto_migrate', true);
    $token = (is_string($mode) && $mode !== '') ? $mode : null;
    $forced = $token !== null && ffk_get_setting('migration_token') !== $token;

    if (!$forced && ffk_get_setting('install_done') === '1') {
        return;
    }

    // Gleichzeitige Erstaufrufe dürfen die Migration nicht doppelt starten.
    $locked = ffk_row("SELECT GET_LOCK('ffk_install', 30) AS ok");
    if (((int) ($locked['ok'] ?? 0)) !== 1) {
        // Ein anderer Aufruf richtet gerade ein und hat die Sperre länger als
        // erwartet. Dann hier nichts tun, statt ein zweites Mal zu befüllen.
        return;
    }
    $unvollstaendig = null;
    try {
        if (!$forced && ffk_get_setting('install_done') === '1') {
            return; // ein paralleler Aufruf war schneller
        }

        if ($forced || ffk_count_users() === 0) {
            if (!$forced && $mode === false) {
                return; // Erstbefüllung abgeschaltet – Flag bewusst nicht setzen
            }
            try {
                // Die Befüllung ergänzt ausschließlich fehlende Einträge –
                // gepflegte Inhalte und Konten bleiben in jedem Fall erhalten.
                ffk_run_migration();
            } catch (FfkIncompleteMediaException $e) {
                // Kein Flag setzen: Sobald der Upload vollständig ist, läuft
                // die Einrichtung beim nächsten Aufruf von selbst weiter.
                $unvollstaendig = $e->getMessage();
            }
            if ($unvollstaendig === null && $token !== null) {
                ffk_set_setting('migration_token', $token);
            }
        }

        if ($unvollstaendig === null) {
            // Neue feste Seiten in bestehenden Datenbanken nachziehen (idempotent):
            // die Migration läuft nur bei leerer Datenbank, daher hier ergänzen.
            if (ffk_get_page_by_slug('first-responder') === null) {
                ffk_create_page([
                    'slug' => 'first-responder',
                    'title' => 'First Responder',
                    'content' => FFK_FIRST_RESPONDER_HTML,
                    'updatedAt' => ffk_now_iso(),
                ]);
            }

            ffk_set_setting('install_done', '1');
        }
    } finally {
        ffk_exec("SELECT RELEASE_LOCK('ffk_install')");
    }

    // Erst nach dem Freigeben der Sperre abbrechen (exit überspringt finally).
    if ($unvollstaendig !== null) {
        error_log('[FFK] Erstbefüllung verschoben: ' . $unvollstaendig);
        ffk_fail(503, $unvollstaendig);
    }
}

/** Liest eine JSON-Datei des WordPress-Exports. */
function ffk_migration_json(string $name): array
{
    $file = ffk_migration_src() . '/json/' . $name . '.json';
    if (!is_file($file)) {
        throw new RuntimeException("Migrationsdatei fehlt: $file");
    }
    $data = json_decode((string) file_get_contents($file), true);
    return is_array($data) ? $data : [];
}

/** Wandelt HTML-Entities in Zeichen um (wie decodeEntities() in migrate.ts). */
function ffk_decode_entities(?string $s): string
{
    if ($s === null || $s === '') {
        return '';
    }
    // &nbsp; wird bewusst zum normalen Leerzeichen (wie bisher), nicht zu U+00A0
    $s = str_replace('&nbsp;', ' ', $s);
    return html_entity_decode($s, ENT_QUOTES | ENT_HTML5, 'UTF-8');
}

/** Entfernt alle Tags und normalisiert Leerraum. */
function ffk_strip_tags_text(?string $html): string
{
    $text = preg_replace('/<[^>]*>/', ' ', (string) $html) ?? '';
    $text = ffk_decode_entities($text);
    $text = preg_replace('/\s+/u', ' ', $text) ?? '';
    return trim($text);
}

/**
 * Zustand der Medien-Zuordnung während der Migration.
 * WP-Media-ID -> lokale URL und Datei-Schlüssel -> lokale URL.
 */
final class FfkMediaIndex
{
    /** @var array<int,string> */
    public array $byId = [];
    /** @var array<string,string> */
    public array $byKey = [];
    /** Anzahl der Bilder, die in uploads/wp/ fehlen oder unvollständig sind. */
    public int $missing = 0;
    /** Gesamtzahl der erwarteten Bilder. */
    public int $expected = 0;
}

/** Liest die Mediathek der alten Seite ein und befüllt die Such-Tabellen. */
function ffk_migration_prepare_media(FfkMediaIndex $index): array
{
    $wpMedia = ffk_migration_json('media');
    $uploads = ffk_migration_uploads();
    ffk_mkdir($uploads);

    $copied = 0;
    $missing = 0;
    foreach ($wpMedia as $m) {
        $src = (string) ($m['source_url'] ?? '');
        if ($src === '') {
            continue;
        }
        $id = (int) ($m['id'] ?? 0);
        $basename = basename(explode('?', $src)[0]);
        $destName = $id . '_' . $basename;
        $dest = $uploads . '/' . $destName;

        $index->expected++;

        // Bereits in uploads/wp vorhandene Dateien (aus dem Paket) direkt nutzen.
        // Eine Datei mit 0 Bytes stammt aus einem abgebrochenen Upload und
        // zählt deshalb ebenfalls als fehlend.
        if (!is_file($dest) || filesize($dest) === 0) {
            $localFile = ffk_migration_src() . '/media/' . $destName;
            if (!is_file($localFile) || filesize($localFile) === 0) {
                $missing++;
                continue;
            }
            @copy($localFile, $dest);
        }
        $url = '/uploads/wp/' . $destName;
        $index->byId[$id] = $url;

        // Schlüssel: "2024/05/foo.jpg" (Pfad relativ zu uploads, ohne Größensuffix)
        $relSrc = rawurldecode($src);
        $rel = preg_replace('#^.*/wp-content/uploads/#', '', explode('?', $relSrc)[0]) ?? '';
        $dir = dirname($rel);
        $ext = pathinfo($basename, PATHINFO_EXTENSION);
        $ext = $ext !== '' ? '.' . $ext : '';
        $stem = $ext !== '' ? substr($basename, 0, -strlen($ext)) : $basename;
        $index->byKey[mb_strtolower($dir . '/' . $stem . $ext, 'UTF-8')] = $url;
        $copied++;
    }
    $index->missing = $missing;
    error_log("[FFK] Migration – Medien: $copied verknüpft, $missing fehlen");
    return $wpMedia;
}

/** Findet die lokale URL für eine alte WP-Upload-URL (auch mit Größensuffix). */
function ffk_migration_resolve_upload(FfkMediaIndex $index, string $oldUrl): ?string
{
    $decoded = rawurldecode($oldUrl);
    $rel = preg_replace('#^.*/wp-content/uploads/#', '', explode('?', $decoded)[0]) ?? '';
    $dir = dirname($rel);
    $base = basename($rel);
    $ext = pathinfo($base, PATHINFO_EXTENSION);
    $ext = $ext !== '' ? '.' . $ext : '';
    $stem = $ext !== '' ? substr($base, 0, -strlen($ext)) : $base;

    $direct = $index->byKey[mb_strtolower($dir . '/' . $stem . $ext, 'UTF-8')] ?? null;
    if ($direct !== null) {
        return $direct;
    }
    // Größensuffix entfernen: foo-300x225 -> foo
    $noSize = preg_replace('/-\d+x\d+$/', '', $stem) ?? $stem;
    $bySize = $index->byKey[mb_strtolower($dir . '/' . $noSize . $ext, 'UTF-8')] ?? null;
    if ($bySize !== null) {
        return $bySize;
    }
    // "-scaled"-Variante probieren
    return $index->byKey[mb_strtolower($dir . '/' . $noSize . '-scaled' . $ext, 'UTF-8')] ?? null;
}

/** Bereinigt WordPress-HTML: Bild-URLs lokal, srcset entfernen, Links anpassen. */
function ffk_migration_process_content(FfkMediaIndex $index, ?string $html): string
{
    $out = (string) $html;

    // srcset / sizes / loading / decoding Attribute entfernen
    $out = preg_replace('/\s(?:srcset|sizes|decoding|fetchpriority)="[^"]*"/', '', $out) ?? $out;

    // Bild- und Link-URLs auf lokale Kopien umschreiben (absolute URLs)
    $out = preg_replace_callback(
        '#(?:https?:)?//(?:www\.)?ff-kirchberg\.de/wp-content/uploads/[^"\'\s\\\\)]+#',
        static fn (array $m) => ffk_migration_resolve_upload($index, $m[0]) ?? $m[0],
        $out
    ) ?? $out;

    // Relative Upload-URLs umschreiben
    $out = preg_replace_callback(
        '#(src|href)="/wp-content/uploads/([^"]+)"#',
        static function (array $m) use ($index): string {
            $local = ffk_migration_resolve_upload($index, '/wp-content/uploads/' . $m[2]);
            return $local !== null ? $m[1] . '="' . $local . '"' : $m[0];
        },
        $out
    ) ?? $out;

    // Verbliebene kaputte Bilder (externe Hosts, wp-includes-Icons) entfernen
    $out = preg_replace('#<img[^>]+src="(?:https?:)?//(?!localhost)[^"]*"[^>]*/?>#', '', $out) ?? $out;
    $out = preg_replace('#<img[^>]+src="/wp-[^"]*"[^>]*/?>#', '', $out) ?? $out;

    // Links auf alte Seiten -> Hash-Routen (nach bestem Wissen)
    $out = preg_replace_callback(
        '#href="https?://(?:www\.)?ff-kirchberg\.de/?([^"]*)"#',
        static function (array $m): string {
            $p = $m[1];
            if (str_starts_with($p, 'wp-content')) {
                return $m[0];
            }
            $clean = rtrim($p, '/');
            if ($clean === '') {
                return 'href="#/"';
            }
            $parts = explode('/', $clean);
            return 'href="#/beitrag/' . end($parts) . '"';
        },
        $out
    ) ?? $out;

    return $out;
}

/** Erzeugt ein performantes Vorschaubild (max. 1280 px, JPEG) für Titelbilder. */
function ffk_migration_make_thumb(?string $localUrl): ?string
{
    static $cache = [];

    if ($localUrl === null || !str_starts_with($localUrl, '/uploads/wp/')) {
        return $localUrl;
    }
    if (preg_match('/\.(jpe?g|png|webp)$/i', $localUrl) !== 1) {
        return $localUrl;
    }
    if (isset($cache[$localUrl])) {
        return $cache[$localUrl];
    }

    $srcFile = ffk_migration_uploads() . '/' . basename($localUrl);
    if (!is_file($srcFile)) {
        return $localUrl;
    }
    $thumbsDir = ffk_migration_uploads() . '/thumbs';
    ffk_mkdir($thumbsDir);

    $name = preg_replace('/\.(jpe?g|png|webp)$/i', '.jpg', basename($localUrl)) ?? basename($localUrl);
    $dest = $thumbsDir . '/' . $name;
    $url = '/uploads/wp/thumbs/' . $name;

    if (is_file($dest) || ffk_make_thumb($srcFile, $dest, 1280, 72)) {
        $cache[$localUrl] = $url;
        return $url;
    }
    $cache[$localUrl] = $localUrl;
    return $localUrl;
}

/**
 * Führt die Erstbefüllung aus.
 *
 * Die Befüllung ist **rein ergänzend**: Sie legt ausschließlich Einträge an,
 * die es noch nicht gibt, und fasst vorhandene niemals an. Gepflegte
 * Mitglieder, Fahrzeuge, Seitentexte, Termine, Benutzer und selbst verfasste
 * Beiträge bleiben also auch dann erhalten, wenn die Befüllung ein zweites
 * Mal läuft. Auf einer leeren Datenbank ist das Ergebnis dasselbe wie zuvor.
 *
 * Anders als in der Node-Fassung werden keine fehlenden Dateien von der alten
 * Website nachgeladen: Alle benötigten Bilder liegen im Paket (uploads/wp/),
 * und der Zielserver soll beim Einrichten keine Verbindung nach außen brauchen.
 */
function ffk_run_migration(): void
{
    @set_time_limit(0);
    @ini_set('memory_limit', '512M');

    $index = new FfkMediaIndex();
    $wpMedia = ffk_migration_prepare_media($index);

    // Abbruch, solange Bilder fehlen: Die Erstbefüllung verknüpft nur Bilder,
    // die zu diesem Zeitpunkt wirklich auf dem Server liegen. Liefe sie mit
    // einem halb übertragenen uploads/-Ordner durch, fehlten die Bilder
    // anschließend dauerhaft in Beiträgen und Mediathek – ohne jeden Hinweis.
    // Deshalb hier abbrechen, ohne die Datenbank anzufassen; sobald der Upload
    // vollständig ist, läuft die Erstbefüllung beim nächsten Aufruf durch.
    if ($index->missing > 0 && !ffk_config('allow_incomplete_media', false)) {
        $vorhanden = $index->expected - $index->missing;
        throw new FfkIncompleteMediaException(sprintf(
            'Die Bilder sind noch nicht vollständig hochgeladen (%d von %d vorhanden). '
            . 'Bitte den Ordner uploads/ vollständig auf den Server übertragen und die Seite '
            . 'danach erneut aufrufen – die Einrichtung setzt dann von selbst fort.',
            $vorhanden,
            $index->expected
        ));
    }

    // ---------- Benutzer ----------
    // Bestehende Konten (und damit geänderte Passwörter) bleiben erhalten –
    // angelegt wird nur, wenn es noch gar keine gibt.
    if (ffk_count_users() === 0) {
        ffk_create_user([
            'username' => 'admin',
            'password' => ffk_hash_password('FFK-Admin-2026!'),
            'displayName' => 'Administrator',
            'role' => 'admin',
            'permissions' => '[]',
            'active' => 1,
        ]);
        ffk_create_user([
            'username' => 'redakteur',
            'password' => ffk_hash_password('FFK-Redakteur-2026!'),
            'displayName' => 'Max Beispiel-Redakteur',
            'role' => 'editor',
            'permissions' => json_encode(['einsaetze', 'neuigkeiten', 'termine']),
            'active' => 1,
        ]);
    }

    // ---------- Kategorien ----------
    $wpCats = ffk_migration_json('categories');
    $catConfig = [
        'einsaetze' => ['color' => 'red', 'isEinsatz' => 1],
        'first-responder' => ['color' => 'blue', 'isEinsatz' => 1],
        'veranstaltungen' => ['color' => 'amber', 'isEinsatz' => 0],
        'pressemeldungen' => ['color' => 'green', 'isEinsatz' => 0],
        'allgemein' => ['color' => 'gray', 'isEinsatz' => 0],
    ];
    $catMap = []; // WP-ID -> ID in dieser Datenbank
    foreach ($wpCats as $c) {
        $slug = (string) ($c['slug'] ?? '');
        // Bereits vorhandene Kategorie unverändert weiterverwenden
        $existing = ffk_get_category_by_slug($slug);
        if ($existing !== null) {
            $catMap[(int) ($c['id'] ?? 0)] = $existing['id'];
            continue;
        }
        $cfg = $catConfig[$slug] ?? ['color' => 'gray', 'isEinsatz' => 0];
        $created = ffk_create_category([
            'name' => ffk_decode_entities((string) ($c['name'] ?? '')),
            'slug' => $slug,
            'color' => $cfg['color'],
            'isEinsatz' => $cfg['isEinsatz'],
        ]);
        $catMap[(int) ($c['id'] ?? 0)] = $created['id'];
    }

    // ---------- Autoren ----------
    $authorMap = [];
    foreach (ffk_migration_json('users') as $u) {
        $authorMap[(int) ($u['id'] ?? 0)] = (string) ($u['name'] ?? '');
    }

    // ---------- Beiträge ----------
    $wpPosts = ffk_migration_json('posts');
    $fallbackCat = ffk_get_category_by_slug('allgemein');
    $fallbackCatId = $fallbackCat !== null ? $fallbackCat['id'] : (int) (reset($catMap) ?: 0);

    $allgemeinWpId = null;
    foreach ($wpCats as $c) {
        if (($c['slug'] ?? '') === 'allgemein') {
            $allgemeinWpId = (int) ($c['id'] ?? 0);
            break;
        }
    }

    $postCount = 0;
    foreach ($wpPosts as $p) {
        // Vorhandene Beiträge nie überschreiben – auch nicht nachträglich
        // bearbeitete. Der Slug ist dauerhaft und eindeutig.
        if (ffk_get_post_by_slug((string) ($p['slug'] ?? '')) !== null) {
            continue;
        }
        $content = ffk_migration_process_content($index, $p['content']['rendered'] ?? '');

        // Nur lokale (erfolgreich migrierte) Bilder als Titelbild verwenden
        $firstLocalImg = null;
        if (preg_match_all('/<img[^>]+src="([^"]+)"/', $content, $matches) > 0) {
            foreach ($matches[1] as $src) {
                if (str_starts_with($src, '/uploads')) {
                    $firstLocalImg = $src;
                    break;
                }
            }
        }
        $featuredMedia = (int) ($p['featured_media'] ?? 0);
        $featuredSource = ($featuredMedia > 0 ? ($index->byId[$featuredMedia] ?? null) : null) ?? $firstLocalImg;
        $featured = ffk_migration_make_thumb($featuredSource);

        $excerpt = ffk_strip_tags_text($p['excerpt']['rendered'] ?? '');
        $excerpt = preg_replace('/\s*(?:Weiterlesen|→).*$/u', '', $excerpt) ?? $excerpt;
        $excerpt = mb_substr($excerpt, 0, 300, 'UTF-8');

        // Spezifischere Kategorie bevorzugen (viele Beiträge sind zusätzlich in "Allgemein")
        $wpCatIds = is_array($p['categories'] ?? null) ? array_map('intval', $p['categories']) : [];
        $wpCatId = null;
        foreach ($wpCatIds as $cid) {
            if ($cid !== $allgemeinWpId) {
                $wpCatId = $cid;
                break;
            }
        }
        if ($wpCatId === null) {
            $wpCatId = $wpCatIds[0] ?? null;
        }

        ffk_create_post([
            'title' => ffk_decode_entities(ffk_strip_tags_text($p['title']['rendered'] ?? '')) ?: '(ohne Titel)',
            'slug' => (string) ($p['slug'] ?? ''),
            'content' => $content,
            'excerpt' => $excerpt,
            'categoryId' => $catMap[$wpCatId] ?? $fallbackCatId,
            'publishedAt' => (string) ($p['date'] ?? ffk_now_iso()),
            'featuredImage' => $featured,
            'images' => '[]',
            'authorName' => $authorMap[(int) ($p['author'] ?? 0)] ?? '',
            'status' => 'published',
            'stichwort' => null,
            'ort' => null,
        ]);
        $postCount++;
    }

    // ---------- Seiten ----------
    $wpPages = ffk_migration_json('pages');
    $bySlug = [];
    foreach ($wpPages as $p) {
        $bySlug[(string) ($p['slug'] ?? '')] = $p;
    }

    $pageDefs = [
        ['slug' => 'ueber-uns', 'title' => 'Über uns', 'wpSlug' => 'ueber-uns'],
        ['slug' => 'chronik', 'title' => 'Chronik', 'wpSlug' => 'geschichte'],
        ['slug' => 'historische-braende', 'title' => 'Historische Brände', 'wpSlug' => 'historische-braende'],
        ['slug' => 'first-responder', 'title' => 'First Responder', 'fallback' => FFK_FIRST_RESPONDER_HTML],
        // Impressum/Datenschutz bewusst nicht aus WordPress übernehmen –
        // aktualisierte Texte nach Rechtsstand 2026 (siehe php/content.php)
        ['slug' => 'impressum', 'title' => 'Impressum', 'fallback' => FFK_IMPRESSUM_HTML],
        ['slug' => 'datenschutz', 'title' => 'Datenschutzerklärung', 'fallback' => FFK_DATENSCHUTZ_HTML],
        ['slug' => 'links', 'title' => 'Links', 'wpSlug' => 'links'],
    ];
    foreach ($pageDefs as $def) {
        if (ffk_get_page_by_slug($def['slug']) !== null) {
            continue; // gepflegter Seitentext bleibt unangetastet
        }
        $wp = isset($def['wpSlug']) ? ($bySlug[$def['wpSlug']] ?? null) : null;
        $title = $def['title'];
        if ($wp !== null) {
            $wpTitle = ffk_decode_entities(ffk_strip_tags_text($wp['title']['rendered'] ?? ''));
            if ($wpTitle !== '') {
                $title = $wpTitle;
            }
        }
        ffk_create_page([
            'slug' => $def['slug'],
            'title' => $title,
            'content' => $wp !== null
                ? ffk_migration_process_content($index, $wp['content']['rendered'] ?? '')
                : ($def['fallback'] ?? '<p>Inhalt folgt.</p>'),
            'updatedAt' => ffk_now_iso(),
        ]);
    }

    // ---------- Fahrzeuge (aus Gerätehaus-Unterseiten) ----------
    $vehicleDefs = [
        ['wpSlug' => 'lf106', 'name' => 'LF 10/6', 'type' => 'Löschgruppenfahrzeug', 'sort' => 1],
        ['wpSlug' => 'mzf', 'name' => 'MZF', 'type' => 'Mehrzweckfahrzeug', 'sort' => 2],
        ['wpSlug' => 'tsf-8', 'name' => 'TSF 8', 'type' => 'Tragkraftspritzenfahrzeug', 'sort' => 3],
    ];
    // Beispiel- und Startdaten nur anlegen, solange die Liste leer ist –
    // gepflegte Einträge dürfen nie ersetzt oder verdoppelt werden.
    foreach (ffk_list_vehicles() === [] ? $vehicleDefs : [] as $v) {
        $wp = $bySlug[$v['wpSlug']] ?? null;
        $content = $wp !== null ? ffk_migration_process_content($index, $wp['content']['rendered'] ?? '') : '';
        $firstImg = null;
        if (preg_match('/<img[^>]+src="([^"]+)"/', $content, $m) === 1) {
            $firstImg = $m[1];
        }
        ffk_create_vehicle([
            'name' => $v['name'],
            'type' => $v['type'],
            'description' => $content !== '' ? $content : '<p>Beschreibung folgt.</p>',
            'image' => ffk_migration_make_thumb($firstImg),
            'images' => '[]',
            'sortOrder' => $v['sort'],
        ]);
    }

    // ---------- Mitglieder (Beispieldaten – echte Daten bitte im Backend pflegen) ----------
    $sampleMembers = [
        ['name' => 'Max Mustermann', 'funktion' => '1. Kommandant', 'gruppe' => 'vorstandschaft', 'sortOrder' => 1],
        ['name' => 'Martin Beispiel', 'funktion' => '2. Kommandant', 'gruppe' => 'vorstandschaft', 'sortOrder' => 2],
        ['name' => 'Josef Beispiel', 'funktion' => '1. Vorstand', 'gruppe' => 'vorstandschaft', 'sortOrder' => 3],
        ['name' => 'Andreas Beispiel', 'funktion' => 'Kassier', 'gruppe' => 'vorstandschaft', 'sortOrder' => 4],
        ['name' => 'Stefan Beispiel', 'funktion' => 'Atemschutzträger', 'gruppe' => 'aktive', 'sortOrder' => 1],
        ['name' => 'Thomas Beispiel', 'funktion' => 'Maschinist', 'gruppe' => 'aktive', 'sortOrder' => 2],
        ['name' => 'Lisa Beispiel', 'funktion' => 'Gruppenführerin', 'gruppe' => 'aktive', 'sortOrder' => 3],
    ];
    foreach (ffk_list_members() === [] ? $sampleMembers : [] as $m) {
        ffk_create_member($m + ['image' => null]);
    }

    // ---------- Termine (Beispieldaten) ----------
    $sampleEvents = [
        ['title' => 'Monatsübung', 'date' => '2026-07-03', 'time' => '19:00', 'location' => 'Gerätehaus Kirchberg', 'description' => 'Beispieltermin – bitte im internen Bereich anpassen.', 'kind' => 'uebung'],
        ['title' => 'Monatsübung', 'date' => '2026-08-07', 'time' => '19:00', 'location' => 'Gerätehaus Kirchberg', 'description' => 'Beispieltermin – bitte im internen Bereich anpassen.', 'kind' => 'uebung'],
        ['title' => 'Christbaumversteigerung 2027', 'date' => '2027-01-09', 'time' => '19:30', 'location' => 'Gasthaus Müller, Schröding', 'description' => 'Beispieltermin – bitte im internen Bereich anpassen.', 'kind' => 'veranstaltung'],
    ];
    foreach (ffk_list_events() === [] ? $sampleEvents : [] as $e) {
        ffk_create_event($e);
    }

    // ---------- Mediathek ----------
    // Bereits eingetragene Bilder überspringen, damit die Mediathek beim
    // erneuten Einlesen keine Dubletten bekommt.
    $bekannteBilder = [];
    foreach (ffk_list_media() as $vorhanden) {
        $bekannteBilder[$vorhanden['url']] = true;
    }
    $mediaCount = 0;
    foreach ($wpMedia as $m) {
        $url = $index->byId[(int) ($m['id'] ?? 0)] ?? null;
        if ($url === null || isset($bekannteBilder[$url])) {
            continue;
        }
        ffk_create_media([
            'filename' => basename($url),
            'url' => $url,
            'title' => ffk_decode_entities(ffk_strip_tags_text($m['title']['rendered'] ?? '')),
            'uploadedAt' => (string) ($m['date'] ?? ''),
            'uploadedBy' => 'Migration',
        ]);
        $mediaCount++;
    }

    error_log("[FFK] Migration abgeschlossen: $postCount Beiträge, $mediaCount Medien");
}
