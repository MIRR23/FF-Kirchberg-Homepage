<?php
/**
 * Alle API-Endpunkte – Portierung von server/routes.ts.
 *
 * Die Pfade sind identisch zur bisherigen Fassung (z. B. /posts/slug/:slug);
 * lediglich die Adressbildung im Browser läuft jetzt über api.php.
 */

declare(strict_types=1);

defined('FFK_APP') || exit;

require_once __DIR__ . '/validate.php';
require_once __DIR__ . '/images.php';
require_once __DIR__ . '/stats.php';

/** Höchstwerte für Uploads (wie bisher in multer konfiguriert). */
const FFK_MEDIA_MAX_FILES = 20;
const FFK_MEDIA_MAX_BYTES = 30 * 1024 * 1024;
const FFK_DOC_MAX_BYTES = 25 * 1024 * 1024;

/**
 * Erlaubte Dateitypen für Downloads (Endung -> Content-Type). Bewusst keine
 * HTML/SVG-Dateien, da diese im Browser Skripte ausführen könnten.
 */
const FFK_DOCUMENT_TYPES = [
    'pdf' => 'application/pdf',
    'doc' => 'application/msword',
    'docx' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'xls' => 'application/vnd.ms-excel',
    'xlsx' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'ppt' => 'application/vnd.ms-powerpoint',
    'pptx' => 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'odt' => 'application/vnd.oasis.opendocument.text',
    'ods' => 'application/vnd.oasis.opendocument.spreadsheet',
    'odp' => 'application/vnd.oasis.opendocument.presentation',
    'csv' => 'text/csv',
    'txt' => 'text/plain',
    'rtf' => 'application/rtf',
    'zip' => 'application/zip',
    'jpg' => 'image/jpeg',
    'jpeg' => 'image/jpeg',
    'png' => 'image/png',
    'webp' => 'image/webp',
    'gif' => 'image/gif',
];

/** Aufzählung der erlaubten Endungen für Fehlermeldungen. */
function ffk_document_extensions(): string
{
    return strtoupper(implode(', ', array_keys(FFK_DOCUMENT_TYPES)));
}

// ---------------------------------------------------------------------------
// Einstellungen
// ---------------------------------------------------------------------------

function ffk_get_hero_settings(): array
{
    $raw = ffk_get_setting('hero');
    if ($raw === null) {
        return FFK_DEFAULT_HERO_SETTINGS;
    }
    $parsed = json_decode($raw, true);
    if (!is_array($parsed)) {
        return FFK_DEFAULT_HERO_SETTINGS;
    }
    $merged = array_merge(FFK_DEFAULT_HERO_SETTINGS, $parsed);
    // Nur bekannte Felder herausgeben (entspricht dem bisherigen Zod-Parse)
    return array_intersect_key($merged, FFK_DEFAULT_HERO_SETTINGS);
}

function ffk_get_site_settings(): array
{
    $raw = ffk_get_setting('site');
    if ($raw === null) {
        return FFK_DEFAULT_SITE_SETTINGS;
    }
    $parsed = json_decode($raw, true);
    if (!is_array($parsed)) {
        return FFK_DEFAULT_SITE_SETTINGS;
    }
    $merged = array_merge(FFK_DEFAULT_SITE_SETTINGS, $parsed);
    return array_intersect_key($merged, FFK_DEFAULT_SITE_SETTINGS);
}

// ---------------------------------------------------------------------------
// Hilfsfunktionen
// ---------------------------------------------------------------------------

/** Bereich, für den ein Beitrag der Kategorie eine Berechtigung verlangt. */
function ffk_post_area(int $categoryId): string
{
    $cat = ffk_get_category($categoryId);
    return ($cat !== null && $cat['isEinsatz'] !== 0) ? 'einsaetze' : 'neuigkeiten';
}

/** Erzeugt einen noch freien Beitrags-Slug. */
function ffk_unique_post_slug(string $base, ?int $excludeId = null): string
{
    $slug = $base;
    $i = 2;
    for (;;) {
        $existing = ffk_get_post_by_slug($slug);
        if ($existing === null || $existing['id'] === $excludeId) {
            return $slug;
        }
        $slug = $base . '-' . $i;
        $i++;
    }
}

/** Erzeugt einen noch freien Dokument-Slug. */
function ffk_unique_document_slug(string $base): string
{
    $slug = $base;
    $i = 2;
    while (ffk_get_document_by_slug($slug) !== null) {
        $slug = $base . '-' . $i;
        $i++;
    }
    return $slug;
}

/** Entfernt das Feld "content" aus Listeneinträgen (Performance wie bisher). */
function ffk_strip_content(array $posts): array
{
    return array_map(static function (array $p): array {
        $p['content'] = '';
        return $p;
    }, $posts);
}

/** Löscht eine Datei aus dem Dokumentenordner (mit Pfadprüfung). */
function ffk_delete_document_file(string $filename): void
{
    $fp = FFK_DOC_DIR . '/' . basename($filename);
    if (is_file($fp) && ffk_path_within(FFK_DOC_DIR, $fp)) {
        @unlink($fp);
    }
}

/**
 * Normalisiert $_FILES für ein Mehrfach-Feld zu einer Liste einzelner Dateien.
 *
 * @return array<int,array{name:string,tmp_name:string,size:int,error:int,type:string}>
 */
function ffk_uploaded_files(string $field): array
{
    if (!isset($_FILES[$field])) {
        return [];
    }
    $f = $_FILES[$field];
    if (!is_array($f['name'])) {
        return [[
            'name' => (string) $f['name'],
            'tmp_name' => (string) $f['tmp_name'],
            'size' => (int) $f['size'],
            'error' => (int) $f['error'],
            'type' => (string) ($f['type'] ?? ''),
        ]];
    }
    $out = [];
    foreach (array_keys($f['name']) as $i) {
        $out[] = [
            'name' => (string) $f['name'][$i],
            'tmp_name' => (string) $f['tmp_name'][$i],
            'size' => (int) $f['size'][$i],
            'error' => (int) $f['error'][$i],
            'type' => (string) ($f['type'][$i] ?? ''),
        ];
    }
    return $out;
}

/**
 * Bricht ab, wenn der Upload die PHP-Grenzen gesprengt hat. In diesem Fall
 * sind $_POST und $_FILES leer, obwohl Daten gesendet wurden.
 */
function ffk_guard_post_size(): void
{
    $len = (int) ($_SERVER['CONTENT_LENGTH'] ?? 0);
    $max = ffk_ini_bytes((string) ini_get('post_max_size'));
    if ($len > 0 && $max > 0 && $len > $max && $_FILES === [] && $_POST === []) {
        ffk_fail(413, 'Der Upload ist zu groß für die Server-Einstellungen. '
            . 'Bitte upload_max_filesize und post_max_size in der PHP-Konfiguration auf mindestens 35 MB erhöhen.');
    }
}

/** Deutsche Meldung für einen PHP-Upload-Fehlercode. */
function ffk_upload_error_message(int $code): string
{
    return match ($code) {
        UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE =>
            'Eine Datei ist zu groß (Bilder max. 30 MB, sonstige Dateien max. 25 MB).',
        UPLOAD_ERR_PARTIAL => 'Der Upload wurde abgebrochen. Bitte erneut versuchen.',
        UPLOAD_ERR_NO_FILE => 'Es wurde keine Datei ausgewählt.',
        UPLOAD_ERR_NO_TMP_DIR, UPLOAD_ERR_CANT_WRITE =>
            'Der Server konnte die Datei nicht speichern (Schreibrechte prüfen).',
        default => 'Der Upload konnte nicht verarbeitet werden.',
    };
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

/**
 * Verarbeitet die Anfrage.
 *
 * @param string $method HTTP-Methode (bereits um _method-Override bereinigt)
 * @param string $path   Pfad ohne /api-Präfix, z. B. "/posts/slug/xyz"
 */
function ffk_handle_request(string $method, string $path): void
{
    $seg = array_values(array_filter(explode('/', trim($path, '/')), static fn ($s) => $s !== ''));

    // ---------- AUTH ----------
    if ($path === '/auth/login' && $method === 'POST') {
        ffk_check_login_rate_limit();
        $b = ffk_body();
        $username = trim((string) ($b['username'] ?? ''));
        $password = (string) ($b['password'] ?? '');
        if ($username === '' || $password === '') {
            ffk_fail(400, 'Benutzername und Passwort erforderlich');
        }
        $user = ffk_get_user_by_username(mb_strtolower($username, 'UTF-8'));
        if ($user === null || $user['active'] === 0 || !ffk_verify_password($password, $user['password'])) {
            ffk_fail(401, 'Benutzername oder Passwort falsch');
        }
        ffk_delete_tokens_before(ffk_token_cutoff_iso()); // abgelaufene Sitzungen aufräumen
        $token = ffk_new_token();
        ffk_create_token($token, $user['id']);
        ffk_json(['token' => $token, 'user' => ffk_safe_user($user)]);
    }

    if ($path === '/auth/logout' && $method === 'POST') {
        ffk_require_auth();
        $token = ffk_bearer_token();
        if ($token !== null) {
            ffk_delete_token($token);
        }
        ffk_json(['ok' => true]);
    }

    if ($path === '/auth/me' && $method === 'GET') {
        ffk_json(ffk_require_auth());
    }

    if ($path === '/auth/change-password' && $method === 'POST') {
        $current = ffk_require_auth();
        $b = ffk_body();
        $newPassword = (string) ($b['newPassword'] ?? '');
        if (mb_strlen($newPassword, 'UTF-8') < 8) {
            ffk_fail(400, 'Neues Passwort muss mindestens 8 Zeichen haben');
        }
        $user = ffk_get_user($current['id']);
        if ($user === null || !ffk_verify_password((string) ($b['oldPassword'] ?? ''), $user['password'])) {
            ffk_fail(401, 'Aktuelles Passwort falsch');
        }
        ffk_update_user($user['id'], ['password' => ffk_hash_password($newPassword)]);
        ffk_json(['ok' => true]);
    }

    // ---------- ÖFFENTLICH ----------
    if ($path === '/categories' && $method === 'GET') {
        ffk_json(ffk_list_categories());
    }

    if ($path === '/posts' && $method === 'GET') {
        $categoryId = null;
        $category = ffk_query('category');
        if ($category !== null) {
            $cat = ffk_get_category_by_slug($category);
            if ($cat === null) {
                ffk_json([]);
            }
            $categoryId = $cat['id'];
        }
        $list = ffk_list_posts([
            'categoryId' => $categoryId,
            'status' => 'published',
            'year' => ffk_query('year'),
        ]);
        if (ffk_query('einsatz') === '1') {
            $einsatzIds = [];
            foreach (ffk_list_categories() as $c) {
                if ($c['isEinsatz'] !== 0) {
                    $einsatzIds[$c['id']] = true;
                }
            }
            $list = array_values(array_filter($list, static fn (array $p) => isset($einsatzIds[$p['categoryId']])));
        }
        $limit = ffk_query('limit');
        if ($limit !== null) {
            $list = array_slice($list, 0, max(0, (int) $limit));
        }
        // Inhalte in Listen nicht mitschicken (Performance)
        ffk_json(ffk_strip_content($list));
    }

    if ($path === '/posts/years' && $method === 'GET') {
        $years = [];
        foreach (ffk_list_posts(['status' => 'published']) as $p) {
            $years[mb_substr($p['publishedAt'], 0, 4, 'UTF-8')] = true;
        }
        // Als Zeichenketten ausgeben – PHP wandelt Array-Schlüssel sonst in Zahlen
        $years = array_map('strval', array_keys($years));
        sort($years);
        ffk_json(array_values(array_reverse($years)));
    }

    if (count($seg) === 3 && $seg[0] === 'posts' && $seg[1] === 'slug' && $method === 'GET') {
        $post = ffk_get_post_by_slug($seg[2]);
        if ($post === null || $post['status'] !== 'published') {
            ffk_fail(404, 'Beitrag nicht gefunden');
        }
        ffk_json($post);
    }

    if ($path === '/events' && $method === 'GET') {
        ffk_json(ffk_list_events());
    }

    if ($path === '/vehicles' && $method === 'GET') {
        ffk_json(ffk_list_vehicles());
    }

    if ($path === '/members' && $method === 'GET') {
        ffk_json(ffk_list_members());
    }

    if (count($seg) === 2 && $seg[0] === 'pages' && $method === 'GET') {
        $page = ffk_get_page_by_slug($seg[1]);
        if ($page === null) {
            ffk_fail(404, 'Seite nicht gefunden');
        }
        ffk_json($page);
    }

    if ($path === '/settings/hero' && $method === 'GET') {
        ffk_json(ffk_get_hero_settings());
    }

    if ($path === '/settings/site' && $method === 'GET') {
        ffk_json(ffk_get_site_settings());
    }

    if ($path === '/stats/hit' && $method === 'POST') {
        ffk_handle_stats_hit();
        exit;
    }

    if ($path === '/stats' && $method === 'GET') {
        $allPosts = ffk_list_posts(['status' => 'published']);
        $einsatzIds = [];
        foreach (ffk_list_categories() as $c) {
            if ($c['isEinsatz'] !== 0) {
                $einsatzIds[$c['id']] = true;
            }
        }
        $einsaetze = array_values(array_filter($allPosts, static fn (array $p) => isset($einsatzIds[$p['categoryId']])));
        $thisYear = (new DateTimeImmutable('now', new DateTimeZone('Europe/Berlin')))->format('Y');
        $aktive = array_filter(ffk_list_members(), static fn (array $m) => $m['gruppe'] === 'aktive');
        ffk_json([
            'einsaetzeGesamt' => count($einsaetze),
            'einsaetzeJahr' => count(array_filter(
                $einsaetze,
                static fn (array $p) => str_starts_with($p['publishedAt'], $thisYear)
            )),
            'fahrzeuge' => count(ffk_list_vehicles()),
            'aktive' => count($aktive),
        ]);
    }

    // ---------- ADMIN: Besucherstatistik ----------
    if ($path === '/admin/stats' && $method === 'GET') {
        ffk_require_auth();
        ffk_json(ffk_admin_stats((int) (ffk_query('days') ?? 30)));
    }

    // ---------- ADMIN: Beiträge ----------
    if ($path === '/admin/posts' && $method === 'GET') {
        $user = ffk_require_auth();
        $visible = array_values(array_filter(
            ffk_list_posts([]),
            static fn (array $p) => ffk_has_permission($user, ffk_post_area($p['categoryId']))
        ));
        ffk_json(ffk_strip_content($visible));
    }

    if ($path === '/admin/posts' && $method === 'POST') {
        $user = ffk_require_auth();
        $data = ffk_validated(ffk_validate_post(ffk_body(), false));
        if (!ffk_has_permission($user, ffk_post_area($data['categoryId']))) {
            ffk_fail(403, 'Keine Berechtigung für diese Kategorie');
        }
        $data['slug'] = ffk_unique_post_slug(ffk_slugify($data['title']));
        if (($data['authorName'] ?? '') === '') {
            $data['authorName'] = $user['displayName'];
        }
        ffk_json(ffk_create_post($data));
    }

    if (count($seg) === 3 && $seg[0] === 'admin' && $seg[1] === 'posts') {
        $id = (int) $seg[2];
        if ($method === 'GET') {
            $user = ffk_require_auth();
            $post = ffk_get_post($id);
            if ($post === null) {
                ffk_fail(404, 'Nicht gefunden');
            }
            if (!ffk_has_permission($user, ffk_post_area($post['categoryId']))) {
                ffk_fail(403, 'Keine Berechtigung');
            }
            ffk_json($post);
        }
        if ($method === 'PATCH') {
            $user = ffk_require_auth();
            $existing = ffk_get_post($id);
            if ($existing === null) {
                ffk_fail(404, 'Nicht gefunden');
            }
            if (!ffk_has_permission($user, ffk_post_area($existing['categoryId']))) {
                ffk_fail(403, 'Keine Berechtigung');
            }
            // Slug bleibt stabil (eindeutig, in Links verwendet) – beim Bearbeiten nie geändert
            $data = ffk_validated(ffk_validate_post(ffk_body(), true));
            if (isset($data['categoryId']) && !ffk_has_permission($user, ffk_post_area($data['categoryId']))) {
                ffk_fail(403, 'Keine Berechtigung für die Ziel-Kategorie');
            }
            ffk_json(ffk_update_post($id, $data));
        }
        if ($method === 'DELETE') {
            $user = ffk_require_auth();
            $existing = ffk_get_post($id);
            if ($existing === null) {
                ffk_fail(404, 'Nicht gefunden');
            }
            if (!ffk_has_permission($user, ffk_post_area($existing['categoryId']))) {
                ffk_fail(403, 'Keine Berechtigung');
            }
            ffk_delete_post($id);
            ffk_json(['ok' => true]);
        }
    }

    // ---------- ADMIN: Reihenfolge von Mitgliedern und Fahrzeugen ----------
    // Muss vor der allgemeinen CRUD-Behandlung stehen, sonst würde "reorder"
    // als Datensatz-Nummer gelesen.
    $reorder = ['members' => ['mitglieder', 'ffk_update_member'], 'vehicles' => ['fahrzeuge', 'ffk_update_vehicle']];
    if (count($seg) === 3 && $seg[0] === 'admin' && $seg[2] === 'reorder' && isset($reorder[$seg[1]]) && $method === 'POST') {
        [$area, $update] = $reorder[$seg[1]];
        $user = ffk_require_auth();
        ffk_require_permission($user, $area);
        $ids = ffk_body()['ids'] ?? null;
        if (!is_array($ids)) {
            ffk_fail(400, 'Es wurde keine Reihenfolge übergeben.');
        }
        // Die Position in der Liste ist die neue Sortiernummer (ab 1).
        $position = 0;
        foreach ($ids as $id) {
            if (!is_int($id) && !(is_string($id) && ctype_digit($id))) {
                ffk_fail(400, 'Die Reihenfolge enthält einen ungültigen Eintrag.');
            }
            $position++;
            $update((int) $id, ['sortOrder' => $position]);
        }
        ffk_json(['ok' => true]);
    }

    // ---------- ADMIN: Termine / Fahrzeuge / Mitglieder ----------
    $crud = [
        'events' => ['termine', 'ffk_validate_event', 'ffk_create_event', 'ffk_update_event', 'ffk_delete_event'],
        'vehicles' => ['fahrzeuge', 'ffk_validate_vehicle', 'ffk_create_vehicle', 'ffk_update_vehicle', 'ffk_delete_vehicle'],
        'members' => ['mitglieder', 'ffk_validate_member', 'ffk_create_member', 'ffk_update_member', 'ffk_delete_member'],
    ];
    if (count($seg) >= 2 && $seg[0] === 'admin' && isset($crud[$seg[1]])) {
        [$area, $validate, $create, $update, $delete] = $crud[$seg[1]];
        if (count($seg) === 2 && $method === 'POST') {
            $user = ffk_require_auth();
            ffk_require_permission($user, $area);
            ffk_json($create(ffk_validated($validate(ffk_body(), false))));
        }
        if (count($seg) === 3) {
            $id = (int) $seg[2];
            if ($method === 'PATCH') {
                $user = ffk_require_auth();
                ffk_require_permission($user, $area);
                ffk_json($update($id, ffk_validated($validate(ffk_body(), true))));
            }
            if ($method === 'DELETE') {
                $user = ffk_require_auth();
                ffk_require_permission($user, $area);
                $delete($id);
                ffk_json(['ok' => true]);
            }
        }
    }

    // ---------- ADMIN: Seiten ----------
    if ($path === '/admin/pages' && $method === 'GET') {
        $user = ffk_require_auth();
        ffk_require_permission($user, 'seiten');
        ffk_json(ffk_list_pages());
    }

    if (count($seg) === 3 && $seg[0] === 'admin' && $seg[1] === 'pages' && $method === 'PATCH') {
        $user = ffk_require_auth();
        ffk_require_permission($user, 'seiten');
        // Slug bleibt stabil – die Website verlinkt Seiten fest über ihren Slug
        $data = ffk_validated(ffk_validate_page(ffk_body()));
        $data['updatedAt'] = ffk_now_iso();
        ffk_json(ffk_update_page((int) $seg[2], $data));
    }

    // ---------- ADMIN: Startseite / Hero ----------
    if ($path === '/admin/settings/hero' && $method === 'PUT') {
        $user = ffk_require_auth();
        ffk_require_permission($user, 'seiten');
        $data = ffk_validated(ffk_validate_hero(ffk_body()));
        $merged = array_merge(ffk_get_hero_settings(), $data);
        ffk_set_setting('hero', json_encode($merged, JSON_UNESCAPED_UNICODE));
        ffk_json($merged);
    }

    if ($path === '/admin/settings/site' && $method === 'PUT') {
        $user = ffk_require_auth();
        ffk_require_permission($user, 'seiten');
        $data = ffk_validated(ffk_validate_site(ffk_body()));
        $merged = array_merge(ffk_get_site_settings(), $data);
        ffk_set_setting('site', json_encode($merged, JSON_UNESCAPED_UNICODE));
        ffk_json($merged);
    }

    // ---------- ADMIN: Medien ----------
    if ($path === '/admin/media' && $method === 'GET') {
        ffk_require_auth();
        ffk_json(ffk_list_media());
    }

    if ($path === '/admin/media' && $method === 'POST') {
        $user = ffk_require_auth();
        ffk_guard_post_size();
        ffk_handle_media_upload($user);
    }

    if (count($seg) === 3 && $seg[0] === 'admin' && $seg[1] === 'media' && $method === 'DELETE') {
        $user = ffk_require_auth();
        ffk_require_permission($user, 'medien');
        $item = ffk_get_media((int) $seg[2]);
        if ($item !== null) {
            $rel = preg_replace('#^/uploads/#', '', $item['url']) ?? '';
            $fp = FFK_UPLOAD_DIR . '/' . $rel;
            if (is_file($fp) && ffk_path_within(FFK_UPLOAD_DIR, $fp)) {
                @unlink($fp);
            }
            ffk_delete_media($item['id']);
        }
        ffk_json(['ok' => true]);
    }

    // ---------- ADMIN: Dateien / Downloads ----------
    // Alle angemeldeten Benutzer sehen die Liste (um Links kopieren zu können),
    // Anlegen/Austauschen/Löschen erfordert die Berechtigung "dateien".
    if ($path === '/admin/documents' && $method === 'GET') {
        ffk_require_auth();
        ffk_json(ffk_list_documents());
    }

    if ($path === '/admin/documents' && $method === 'POST') {
        $user = ffk_require_auth();
        ffk_require_permission($user, 'dateien');
        ffk_guard_post_size();
        ffk_handle_document_create($user);
    }

    if (count($seg) === 3 && $seg[0] === 'admin' && $seg[1] === 'documents') {
        $id = (int) $seg[2];
        if ($method === 'PATCH') {
            $user = ffk_require_auth();
            ffk_require_permission($user, 'dateien');
            ffk_guard_post_size();
            ffk_handle_document_update($user, $id);
        }
        if ($method === 'DELETE') {
            $user = ffk_require_auth();
            ffk_require_permission($user, 'dateien');
            $existing = ffk_get_document($id);
            if ($existing !== null) {
                ffk_delete_document_file($existing['filename']);
                ffk_delete_document($existing['id']);
            }
            ffk_json(['ok' => true]);
        }
    }

    // ---------- ADMIN: Benutzerverwaltung (nur Admin) ----------
    if ($path === '/admin/users' && $method === 'GET') {
        $user = ffk_require_auth();
        ffk_require_admin($user);
        ffk_json(array_map('ffk_safe_user', ffk_list_users()));
    }

    if ($path === '/admin/users' && $method === 'POST') {
        $current = ffk_require_auth();
        ffk_require_admin($current);
        $b = ffk_body();
        $username = trim((string) ($b['username'] ?? ''));
        $password = (string) ($b['password'] ?? '');
        $displayName = (string) ($b['displayName'] ?? '');
        if ($username === '' || $password === '' || $displayName === '') {
            ffk_fail(400, 'Benutzername, Passwort und Anzeigename erforderlich');
        }
        if (mb_strlen($password, 'UTF-8') < 8) {
            ffk_fail(400, 'Passwort muss mindestens 8 Zeichen haben');
        }
        $username = mb_strtolower($username, 'UTF-8');
        if (ffk_get_user_by_username($username) !== null) {
            ffk_fail(400, 'Benutzername bereits vergeben');
        }
        $perms = is_array($b['permissions'] ?? null)
            ? array_values(array_filter(
                $b['permissions'],
                static fn ($p) => is_string($p) && in_array($p, FFK_PERMISSION_AREAS, true)
            ))
            : [];
        $created = ffk_create_user([
            'username' => $username,
            'password' => ffk_hash_password($password),
            'displayName' => $displayName,
            'role' => (($b['role'] ?? '') === 'admin') ? 'admin' : 'editor',
            'permissions' => json_encode($perms, JSON_UNESCAPED_UNICODE),
            'active' => 1,
        ]);
        ffk_json(ffk_safe_user($created));
    }

    if (count($seg) === 3 && $seg[0] === 'admin' && $seg[1] === 'users') {
        $id = (int) $seg[2];
        if ($method === 'PATCH') {
            $current = ffk_require_auth();
            ffk_require_admin($current);
            $existing = ffk_get_user($id);
            if ($existing === null) {
                ffk_fail(404, 'Nicht gefunden');
            }
            $b = ffk_body();
            $update = [];
            if (!empty($b['displayName'])) {
                $update['displayName'] = (string) $b['displayName'];
            }
            if (!empty($b['role'])) {
                $update['role'] = $b['role'] === 'admin' ? 'admin' : 'editor';
            }
            if (isset($b['active']) && is_int($b['active'])) {
                $update['active'] = $b['active'] ? 1 : 0;
            }
            if (is_array($b['permissions'] ?? null)) {
                $update['permissions'] = json_encode(array_values(array_filter(
                    $b['permissions'],
                    static fn ($p) => is_string($p) && in_array($p, FFK_PERMISSION_AREAS, true)
                )), JSON_UNESCAPED_UNICODE);
            }
            if (!empty($b['password'])) {
                if (mb_strlen((string) $b['password'], 'UTF-8') < 8) {
                    ffk_fail(400, 'Passwort muss mindestens 8 Zeichen haben');
                }
                $update['password'] = ffk_hash_password((string) $b['password']);
            }
            // Sicherheitsnetz: letzten aktiven Admin nicht degradieren/deaktivieren
            if ($existing['role'] === 'admin'
                && ((($update['role'] ?? null) === 'editor') || (($update['active'] ?? null) === 0))
                && !ffk_has_other_active_admin($id)
            ) {
                ffk_fail(400, 'Der letzte Administrator kann nicht deaktiviert werden');
            }
            $updated = ffk_update_user($id, $update);
            ffk_json($updated !== null ? ffk_safe_user($updated) : null);
        }
        if ($method === 'DELETE') {
            $current = ffk_require_auth();
            ffk_require_admin($current);
            $existing = ffk_get_user($id);
            if ($existing === null) {
                ffk_fail(404, 'Nicht gefunden');
            }
            if ($existing['role'] === 'admin' && !ffk_has_other_active_admin($id)) {
                ffk_fail(400, 'Der letzte Administrator kann nicht gelöscht werden');
            }
            ffk_delete_user($id);
            ffk_json(['ok' => true]);
        }
    }

    ffk_fail(404, 'Diese Adresse gibt es nicht.');
}

/** true, wenn es außer $exceptId noch einen weiteren aktiven Administrator gibt. */
function ffk_has_other_active_admin(int $exceptId): bool
{
    foreach (ffk_list_users() as $u) {
        if ($u['role'] === 'admin' && $u['active'] !== 0 && $u['id'] !== $exceptId) {
            return true;
        }
    }
    return false;
}

// ---------------------------------------------------------------------------
// Upload-Verarbeitung
// ---------------------------------------------------------------------------

/** Bilder in die Mediathek hochladen (multipart, Feld "files[]"). */
function ffk_handle_media_upload(array $user): never
{
    $files = ffk_uploaded_files('files');
    if ($files === []) {
        ffk_fail(400, 'Keine Bilder hochgeladen (JPG, PNG, GIF, WebP, max. 30 MB)');
    }
    if (count($files) > FFK_MEDIA_MAX_FILES) {
        ffk_fail(400, 'Zu viele Dateien auf einmal (max. ' . FFK_MEDIA_MAX_FILES . ' Bilder pro Upload).');
    }

    $dir = FFK_UPLOAD_DIR . '/neu';
    ffk_mkdir($dir);

    if (!is_dir($dir) || !is_writable($dir)) {
        ffk_fail(500, 'Der Ordner uploads/neu/ ist nicht beschreibbar. Bitte die Schreibrechte '
            . 'für uploads/ auf dem Server prüfen (meist 755 oder 775).');
    }

    $created = [];
    $gruende = [];
    foreach ($files as $f) {
        if ($f['error'] !== UPLOAD_ERR_OK) {
            if ($f['error'] === UPLOAD_ERR_NO_FILE) {
                continue;
            }
            ffk_fail(400, ffk_upload_error_message($f['error']));
        }
        if ($f['size'] > FFK_MEDIA_MAX_BYTES) {
            ffk_fail(400, 'Eine Datei ist zu groß (Bilder max. 30 MB).');
        }
        // Nur echte Bilder annehmen (Typ aus dem Dateiinhalt, nicht aus dem Browser)
        $info = @getimagesize($f['tmp_name']);
        if ($info === false || !in_array((string) ($info['mime'] ?? ''), FFK_IMAGE_MIME_TYPES, true)) {
            $gruende[] = sprintf('„%s“: %s', $f['name'], ffk_describe_unreadable_image($f['tmp_name']));
            continue;
        }

        $filename = ffk_unique_filename($dir, $f['name']);
        $dest = $dir . '/' . $filename;
        if (!ffk_move_uploaded($f['tmp_name'], $dest)) {
            $gruende[] = sprintf('„%s“: konnte nicht gespeichert werden (Schreibrechte in uploads/).', $f['name']);
            continue;
        }

        // Fürs Web optimieren: verkleinern, Metadaten/GPS entfernen
        try {
            $optimized = ffk_optimize_image($dest, (string) $info['mime']);
        } catch (FfkImageException $e) {
            @unlink($dest); // unbrauchbare Datei nicht liegen lassen
            error_log('[FFK] Bild-Upload fehlgeschlagen: ' . $e->getMessage());
            $gruende[] = sprintf('„%s“: %s', $f['name'], $e->getMessage());
            continue;
        }
        $filename = basename($optimized);

        $created[] = ffk_create_media([
            'filename' => $filename,
            'url' => '/uploads/neu/' . $filename,
            'title' => $f['name'],
            'uploadedAt' => ffk_now_iso(),
            'uploadedBy' => $user['displayName'],
        ]);
    }

    if ($created === []) {
        // Die genaue Ursache nennen – „ging nicht" hilft beim Beheben nicht weiter.
        ffk_fail(400, $gruende === []
            ? 'Es wurde keine Datei empfangen.'
            : implode(' ', array_slice($gruende, 0, 3)));
    }
    ffk_json($created);
}

/** Neue Datei mit stabilem Link anlegen. */
function ffk_handle_document_create(array $user): never
{
    $files = ffk_uploaded_files('file');
    $f = $files[0] ?? null;
    if ($f === null || $f['error'] === UPLOAD_ERR_NO_FILE) {
        ffk_fail(400, 'Keine gültige Datei hochgeladen (erlaubt: ' . ffk_document_extensions() . ', max. 25 MB)');
    }
    $stored = ffk_store_document_file($f);

    $title = trim((string) ($_POST['title'] ?? ''));
    if ($title === '') {
        $title = preg_replace('/\.[a-z0-9]+$/i', '', $f['name']) ?? $f['name'];
    }
    $slug = ffk_unique_document_slug(ffk_slugify($title));

    ffk_json(ffk_create_document([
        'slug' => $slug,
        'title' => $title,
        'filename' => $stored['filename'],
        'originalName' => $f['name'],
        'mimeType' => $stored['mimeType'],
        'size' => $stored['size'],
        'updatedAt' => ffk_now_iso(),
        'updatedBy' => $user['displayName'],
    ]));
}

/**
 * Datei austauschen und/oder umbenennen. Der Slug – und damit der öffentliche
 * Link – bleibt dabei unverändert; die alte Datei wird gelöscht.
 */
function ffk_handle_document_update(array $user, int $id): never
{
    $files = ffk_uploaded_files('file');
    $f = $files[0] ?? null;
    $hasFile = $f !== null && $f['error'] !== UPLOAD_ERR_NO_FILE;

    $existing = ffk_get_document($id);
    if ($existing === null) {
        ffk_fail(404, 'Nicht gefunden');
    }

    $update = [];
    $title = trim((string) ($_POST['title'] ?? ''));
    if ($title !== '') {
        $update['title'] = $title;
    }
    if ($hasFile) {
        $stored = ffk_store_document_file($f);
        ffk_delete_document_file($existing['filename']);
        $update['filename'] = $stored['filename'];
        $update['originalName'] = $f['name'];
        $update['mimeType'] = $stored['mimeType'];
        $update['size'] = $stored['size'];
    }
    $update['updatedAt'] = ffk_now_iso();
    $update['updatedBy'] = $user['displayName'];

    ffk_json(ffk_update_document($id, $update));
}

/**
 * Prüft und speichert eine hochgeladene Datei im Dokumentenordner.
 *
 * @return array{filename:string,mimeType:string,size:int}
 */
function ffk_store_document_file(array $f): array
{
    if ($f['error'] !== UPLOAD_ERR_OK) {
        ffk_fail(400, ffk_upload_error_message($f['error']));
    }
    if ($f['size'] > FFK_DOC_MAX_BYTES) {
        ffk_fail(400, 'Die Datei ist zu groß (max. 25 MB).');
    }
    $ext = strtolower(pathinfo($f['name'], PATHINFO_EXTENSION));
    if (!isset(FFK_DOCUMENT_TYPES[$ext])) {
        ffk_fail(400, 'Dieser Dateityp ist nicht erlaubt. Erlaubt sind: ' . ffk_document_extensions() . '.');
    }

    ffk_mkdir(FFK_DOC_DIR);
    $filename = ffk_unique_filename(FFK_DOC_DIR, $f['name']);
    if (!ffk_move_uploaded($f['tmp_name'], FFK_DOC_DIR . '/' . $filename)) {
        ffk_fail(500, 'Die Datei konnte nicht gespeichert werden.');
    }

    return [
        'filename' => $filename,
        'mimeType' => FFK_DOCUMENT_TYPES[$ext],
        'size' => $f['size'],
    ];
}

/**
 * Verschiebt eine hochgeladene Datei ans Ziel. Fällt auf rename() zurück,
 * damit die Funktion auch im Test mit simulierten Uploads arbeitet.
 */
function ffk_move_uploaded(string $tmp, string $dest): bool
{
    if (is_uploaded_file($tmp)) {
        return move_uploaded_file($tmp, $dest);
    }
    return is_file($tmp) && @rename($tmp, $dest);
}
