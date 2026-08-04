<?php
/**
 * Datenzugriff – 1:1-Portierung von server/storage.ts.
 *
 * Alle Funktionen liefern die Daten bereits in der Form, die das Frontend
 * erwartet: camelCase-Schlüssel (wie zuvor durch Drizzle) und echte Zahlen
 * statt Zeichenketten, damit sich am JSON der API nichts ändert.
 */

declare(strict_types=1);

defined('FFK_APP') || exit;

/** Berechtigungsbereiche (identisch zu PERMISSION_AREAS in shared/schema.ts). */
const FFK_PERMISSION_AREAS = [
    'einsaetze',
    'neuigkeiten',
    'termine',
    'fahrzeuge',
    'mitglieder',
    'seiten',
    'medien',
    'dateien',
];

const FFK_DEFAULT_HERO_SETTINGS = [
    'mode' => 'auto',
    'image' => '/uploads/hero-standard.png',
    'fit' => 'cover',
    'overlay' => 65,
    'title' => 'Wenn jede *Minute* zählt.',
    'intro' => 'Aktive Einsatzkräfte, moderne Fahrzeuge und eine eigene First-Responder-Einheit – rund um die Uhr einsatzbereit für Kirchberg und das Erdinger Holzland.',
    'alt' => 'Wappen der Freiwilligen Feuerwehr Kirchberg und Logo der First Responder Kirchberg',
];

const FFK_DEFAULT_SITE_SETTINGS = [
    'linksNewTab' => true,
];

// ---------------------------------------------------------------------------
// Zeilen-Abbildung (snake_case-Spalten -> camelCase-Felder mit echten Typen)
// ---------------------------------------------------------------------------

function ffk_map_user(?array $r): ?array
{
    if ($r === null) {
        return null;
    }
    return [
        'id' => (int) $r['id'],
        'username' => (string) $r['username'],
        'password' => (string) $r['password'],
        'displayName' => (string) $r['display_name'],
        'role' => (string) $r['role'],
        'permissions' => (string) $r['permissions'],
        'active' => (int) $r['active'],
    ];
}

function ffk_map_category(?array $r): ?array
{
    if ($r === null) {
        return null;
    }
    return [
        'id' => (int) $r['id'],
        'name' => (string) $r['name'],
        'slug' => (string) $r['slug'],
        'color' => (string) $r['color'],
        'isEinsatz' => (int) $r['is_einsatz'],
    ];
}

function ffk_map_post(?array $r): ?array
{
    if ($r === null) {
        return null;
    }
    return [
        'id' => (int) $r['id'],
        'title' => (string) $r['title'],
        'slug' => (string) $r['slug'],
        'content' => (string) $r['content'],
        'excerpt' => (string) $r['excerpt'],
        'categoryId' => (int) $r['category_id'],
        'publishedAt' => (string) $r['published_at'],
        'featuredImage' => $r['featured_image'] !== null ? (string) $r['featured_image'] : null,
        'images' => (string) $r['images'],
        'authorName' => (string) $r['author_name'],
        'status' => (string) $r['status'],
        'stichwort' => $r['stichwort'] !== null ? (string) $r['stichwort'] : null,
        'ort' => $r['ort'] !== null ? (string) $r['ort'] : null,
        'lat' => $r['lat'] !== null ? (float) $r['lat'] : null,
        'lng' => $r['lng'] !== null ? (float) $r['lng'] : null,
    ];
}

function ffk_map_event(?array $r): ?array
{
    if ($r === null) {
        return null;
    }
    return [
        'id' => (int) $r['id'],
        'title' => (string) $r['title'],
        'date' => (string) $r['date'],
        'time' => (string) $r['time'],
        'location' => (string) $r['location'],
        'description' => (string) $r['description'],
        'kind' => (string) $r['kind'],
        'lat' => $r['lat'] !== null ? (float) $r['lat'] : null,
        'lng' => $r['lng'] !== null ? (float) $r['lng'] : null,
    ];
}

function ffk_map_vehicle(?array $r): ?array
{
    if ($r === null) {
        return null;
    }
    return [
        'id' => (int) $r['id'],
        'name' => (string) $r['name'],
        'type' => (string) $r['type'],
        'description' => (string) $r['description'],
        'image' => $r['image'] !== null ? (string) $r['image'] : null,
        'images' => (string) $r['images'],
        'sortOrder' => (int) $r['sort_order'],
    ];
}

function ffk_map_member(?array $r): ?array
{
    if ($r === null) {
        return null;
    }
    return [
        'id' => (int) $r['id'],
        'name' => (string) $r['name'],
        'funktion' => (string) $r['funktion'],
        'gruppe' => (string) $r['gruppe'],
        'image' => $r['image'] !== null ? (string) $r['image'] : null,
        'sortOrder' => (int) $r['sort_order'],
    ];
}

function ffk_map_page(?array $r): ?array
{
    if ($r === null) {
        return null;
    }
    return [
        'id' => (int) $r['id'],
        'slug' => (string) $r['slug'],
        'title' => (string) $r['title'],
        'content' => (string) $r['content'],
        'updatedAt' => (string) $r['updated_at'],
    ];
}

function ffk_map_media(?array $r): ?array
{
    if ($r === null) {
        return null;
    }
    return [
        'id' => (int) $r['id'],
        'filename' => (string) $r['filename'],
        'url' => (string) $r['url'],
        'title' => (string) $r['title'],
        'uploadedAt' => (string) $r['uploaded_at'],
        'uploadedBy' => (string) $r['uploaded_by'],
    ];
}

function ffk_map_document(?array $r): ?array
{
    if ($r === null) {
        return null;
    }
    return [
        'id' => (int) $r['id'],
        'slug' => (string) $r['slug'],
        'title' => (string) $r['title'],
        'filename' => (string) $r['filename'],
        'originalName' => (string) $r['original_name'],
        'mimeType' => (string) $r['mime_type'],
        'size' => (int) $r['size'],
        'updatedAt' => (string) $r['updated_at'],
        'updatedBy' => (string) $r['updated_by'],
    ];
}

/** Wendet einen Mapper auf eine Liste an. */
function ffk_map_all(array $rows, callable $mapper): array
{
    return array_values(array_map(static fn (array $r) => $mapper($r), $rows));
}

/**
 * Baut aus einem Datensatz (camelCase) die Spaltenliste für INSERT/UPDATE.
 * $fields bildet Feldname -> Spaltenname ab; nur vorhandene Felder werden
 * übernommen (für PATCH-Teilaktualisierungen).
 */
function ffk_columns(array $data, array $fields): array
{
    $cols = [];
    foreach ($fields as $field => $column) {
        if (array_key_exists($field, $data)) {
            $cols[$column] = $data[$field];
        }
    }
    return $cols;
}

/** Führt ein INSERT aus und liefert die neue ID. */
function ffk_insert(string $table, array $cols): int
{
    if ($cols === []) {
        throw new RuntimeException('INSERT ohne Spalten');
    }
    $names = array_keys($cols);
    $sql = 'INSERT INTO `' . $table . '` (`' . implode('`, `', $names) . '`) VALUES ('
        . implode(', ', array_fill(0, count($names), '?')) . ')';
    ffk_exec($sql, array_values($cols));
    return (int) ffk_db()->lastInsertId();
}

/** Führt ein UPDATE nach ID aus (tut nichts, wenn keine Spalten übergeben werden). */
function ffk_update(string $table, int $id, array $cols): void
{
    if ($cols === []) {
        return;
    }
    $sets = [];
    foreach (array_keys($cols) as $name) {
        $sets[] = '`' . $name . '` = ?';
    }
    $params = array_values($cols);
    $params[] = $id;
    ffk_exec('UPDATE `' . $table . '` SET ' . implode(', ', $sets) . ' WHERE id = ?', $params);
}

// ---------------------------------------------------------------------------
// Benutzer
// ---------------------------------------------------------------------------

const FFK_USER_FIELDS = [
    'username' => 'username',
    'password' => 'password',
    'displayName' => 'display_name',
    'role' => 'role',
    'permissions' => 'permissions',
    'active' => 'active',
];

function ffk_get_user(int $id): ?array
{
    return ffk_map_user(ffk_row('SELECT * FROM users WHERE id = ?', [$id]));
}

function ffk_get_user_by_username(string $username): ?array
{
    return ffk_map_user(ffk_row('SELECT * FROM users WHERE username = ?', [$username]));
}

function ffk_list_users(): array
{
    return ffk_map_all(ffk_all('SELECT * FROM users ORDER BY username ASC'), 'ffk_map_user');
}

function ffk_create_user(array $u): array
{
    $id = ffk_insert('users', ffk_columns($u, FFK_USER_FIELDS));
    return ffk_get_user($id) ?? [];
}

function ffk_update_user(int $id, array $u): ?array
{
    ffk_update('users', $id, ffk_columns($u, FFK_USER_FIELDS));
    return ffk_get_user($id);
}

function ffk_delete_user(int $id): void
{
    ffk_exec('DELETE FROM auth_tokens WHERE user_id = ?', [$id]);
    ffk_exec('DELETE FROM users WHERE id = ?', [$id]);
}

function ffk_count_users(): int
{
    return (int) (ffk_row('SELECT COUNT(*) AS n FROM users')['n'] ?? 0);
}

// ---------------------------------------------------------------------------
// Anmelde-Token
// ---------------------------------------------------------------------------

function ffk_create_token(string $token, int $userId): void
{
    ffk_exec('INSERT INTO auth_tokens (token, user_id, created_at) VALUES (?, ?, ?)', [
        $token,
        $userId,
        ffk_now_iso(),
    ]);
}

function ffk_get_token(string $token): ?array
{
    $r = ffk_row('SELECT * FROM auth_tokens WHERE token = ?', [$token]);
    if ($r === null) {
        return null;
    }
    return [
        'token' => (string) $r['token'],
        'userId' => (int) $r['user_id'],
        'createdAt' => (string) $r['created_at'],
    ];
}

function ffk_delete_token(string $token): void
{
    ffk_exec('DELETE FROM auth_tokens WHERE token = ?', [$token]);
}

/** Entfernt alle Tokens, die vor dem Stichtag erstellt wurden (abgelaufene Sitzungen). */
function ffk_delete_tokens_before(string $cutoffIso): void
{
    ffk_exec('DELETE FROM auth_tokens WHERE created_at < ?', [$cutoffIso]);
}

// ---------------------------------------------------------------------------
// Kategorien
// ---------------------------------------------------------------------------

function ffk_list_categories(): array
{
    return ffk_map_all(ffk_all('SELECT * FROM categories ORDER BY name ASC'), 'ffk_map_category');
}

function ffk_get_category(int $id): ?array
{
    return ffk_map_category(ffk_row('SELECT * FROM categories WHERE id = ?', [$id]));
}

function ffk_get_category_by_slug(string $slug): ?array
{
    return ffk_map_category(ffk_row('SELECT * FROM categories WHERE slug = ?', [$slug]));
}

function ffk_create_category(array $c): array
{
    $id = ffk_insert('categories', ffk_columns($c, [
        'name' => 'name',
        'slug' => 'slug',
        'color' => 'color',
        'isEinsatz' => 'is_einsatz',
    ]));
    return ffk_get_category($id) ?? [];
}

// ---------------------------------------------------------------------------
// Beiträge
// ---------------------------------------------------------------------------

const FFK_POST_FIELDS = [
    'title' => 'title',
    'slug' => 'slug',
    'content' => 'content',
    'excerpt' => 'excerpt',
    'categoryId' => 'category_id',
    'publishedAt' => 'published_at',
    'featuredImage' => 'featured_image',
    'images' => 'images',
    'authorName' => 'author_name',
    'status' => 'status',
    'stichwort' => 'stichwort',
    'ort' => 'ort',
    'lat' => 'lat',
    'lng' => 'lng',
];

/** @param array{categoryId?:int,status?:string,year?:string} $opts */
function ffk_list_posts(array $opts = []): array
{
    $where = [];
    $params = [];
    if (!empty($opts['categoryId'])) {
        $where[] = 'category_id = ?';
        $params[] = (int) $opts['categoryId'];
    }
    if (!empty($opts['status'])) {
        $where[] = 'status = ?';
        $params[] = (string) $opts['status'];
    }
    if (!empty($opts['year'])) {
        $where[] = 'published_at LIKE ?';
        $params[] = $opts['year'] . '-%';
    }
    $sql = 'SELECT * FROM posts';
    if ($where !== []) {
        $sql .= ' WHERE ' . implode(' AND ', $where);
    }
    $sql .= ' ORDER BY published_at DESC';
    return ffk_map_all(ffk_all($sql, $params), 'ffk_map_post');
}

function ffk_get_post(int $id): ?array
{
    return ffk_map_post(ffk_row('SELECT * FROM posts WHERE id = ?', [$id]));
}

function ffk_get_post_by_slug(string $slug): ?array
{
    return ffk_map_post(ffk_row('SELECT * FROM posts WHERE slug = ?', [$slug]));
}

function ffk_create_post(array $p): array
{
    $id = ffk_insert('posts', ffk_columns($p, FFK_POST_FIELDS));
    return ffk_get_post($id) ?? [];
}

function ffk_update_post(int $id, array $p): ?array
{
    ffk_update('posts', $id, ffk_columns($p, FFK_POST_FIELDS));
    return ffk_get_post($id);
}

function ffk_delete_post(int $id): void
{
    ffk_exec('DELETE FROM posts WHERE id = ?', [$id]);
}

// ---------------------------------------------------------------------------
// Termine
// ---------------------------------------------------------------------------

const FFK_EVENT_FIELDS = [
    'title' => 'title',
    'date' => 'date',
    'time' => 'time',
    'location' => 'location',
    'description' => 'description',
    'kind' => 'kind',
    'lat' => 'lat',
    'lng' => 'lng',
];

function ffk_list_events(): array
{
    return ffk_map_all(ffk_all('SELECT * FROM events ORDER BY date ASC'), 'ffk_map_event');
}

function ffk_get_event(int $id): ?array
{
    return ffk_map_event(ffk_row('SELECT * FROM events WHERE id = ?', [$id]));
}

function ffk_create_event(array $e): array
{
    $id = ffk_insert('events', ffk_columns($e, FFK_EVENT_FIELDS));
    return ffk_get_event($id) ?? [];
}

function ffk_update_event(int $id, array $e): ?array
{
    ffk_update('events', $id, ffk_columns($e, FFK_EVENT_FIELDS));
    return ffk_get_event($id);
}

function ffk_delete_event(int $id): void
{
    ffk_exec('DELETE FROM events WHERE id = ?', [$id]);
}

// ---------------------------------------------------------------------------
// Fahrzeuge
// ---------------------------------------------------------------------------

const FFK_VEHICLE_FIELDS = [
    'name' => 'name',
    'type' => 'type',
    'description' => 'description',
    'image' => 'image',
    'images' => 'images',
    'sortOrder' => 'sort_order',
];

function ffk_list_vehicles(): array
{
    return ffk_map_all(ffk_all('SELECT * FROM vehicles ORDER BY sort_order ASC'), 'ffk_map_vehicle');
}

function ffk_get_vehicle(int $id): ?array
{
    return ffk_map_vehicle(ffk_row('SELECT * FROM vehicles WHERE id = ?', [$id]));
}

function ffk_create_vehicle(array $v): array
{
    $id = ffk_insert('vehicles', ffk_columns($v, FFK_VEHICLE_FIELDS));
    return ffk_get_vehicle($id) ?? [];
}

function ffk_update_vehicle(int $id, array $v): ?array
{
    ffk_update('vehicles', $id, ffk_columns($v, FFK_VEHICLE_FIELDS));
    return ffk_get_vehicle($id);
}

function ffk_delete_vehicle(int $id): void
{
    ffk_exec('DELETE FROM vehicles WHERE id = ?', [$id]);
}

// ---------------------------------------------------------------------------
// Mitglieder
// ---------------------------------------------------------------------------

const FFK_MEMBER_FIELDS = [
    'name' => 'name',
    'funktion' => 'funktion',
    'gruppe' => 'gruppe',
    'image' => 'image',
    'sortOrder' => 'sort_order',
];

function ffk_list_members(): array
{
    return ffk_map_all(ffk_all('SELECT * FROM members ORDER BY sort_order ASC, name ASC'), 'ffk_map_member');
}

function ffk_get_member(int $id): ?array
{
    return ffk_map_member(ffk_row('SELECT * FROM members WHERE id = ?', [$id]));
}

function ffk_create_member(array $m): array
{
    $id = ffk_insert('members', ffk_columns($m, FFK_MEMBER_FIELDS));
    return ffk_get_member($id) ?? [];
}

function ffk_update_member(int $id, array $m): ?array
{
    ffk_update('members', $id, ffk_columns($m, FFK_MEMBER_FIELDS));
    return ffk_get_member($id);
}

function ffk_delete_member(int $id): void
{
    ffk_exec('DELETE FROM members WHERE id = ?', [$id]);
}

// ---------------------------------------------------------------------------
// Seiten
// ---------------------------------------------------------------------------

const FFK_PAGE_FIELDS = [
    'slug' => 'slug',
    'title' => 'title',
    'content' => 'content',
    'updatedAt' => 'updated_at',
];

function ffk_list_pages(): array
{
    return ffk_map_all(ffk_all('SELECT * FROM pages ORDER BY title ASC'), 'ffk_map_page');
}

function ffk_get_page_by_slug(string $slug): ?array
{
    return ffk_map_page(ffk_row('SELECT * FROM pages WHERE slug = ?', [$slug]));
}

function ffk_get_page(int $id): ?array
{
    return ffk_map_page(ffk_row('SELECT * FROM pages WHERE id = ?', [$id]));
}

function ffk_create_page(array $p): array
{
    $id = ffk_insert('pages', ffk_columns($p, FFK_PAGE_FIELDS));
    return ffk_get_page($id) ?? [];
}

function ffk_update_page(int $id, array $p): ?array
{
    ffk_update('pages', $id, ffk_columns($p, FFK_PAGE_FIELDS));
    return ffk_get_page($id);
}

// ---------------------------------------------------------------------------
// Mediathek
// ---------------------------------------------------------------------------

function ffk_list_media(): array
{
    return ffk_map_all(ffk_all('SELECT * FROM media ORDER BY id DESC'), 'ffk_map_media');
}

function ffk_get_media(int $id): ?array
{
    return ffk_map_media(ffk_row('SELECT * FROM media WHERE id = ?', [$id]));
}

function ffk_create_media(array $m): array
{
    $id = ffk_insert('media', ffk_columns($m, [
        'filename' => 'filename',
        'url' => 'url',
        'title' => 'title',
        'uploadedAt' => 'uploaded_at',
        'uploadedBy' => 'uploaded_by',
    ]));
    return ffk_get_media($id) ?? [];
}

function ffk_delete_media(int $id): void
{
    ffk_exec('DELETE FROM media WHERE id = ?', [$id]);
}

// ---------------------------------------------------------------------------
// Dokumente (Dateien mit stabilem Link)
// ---------------------------------------------------------------------------

const FFK_DOCUMENT_FIELDS = [
    'slug' => 'slug',
    'title' => 'title',
    'filename' => 'filename',
    'originalName' => 'original_name',
    'mimeType' => 'mime_type',
    'size' => 'size',
    'updatedAt' => 'updated_at',
    'updatedBy' => 'updated_by',
];

function ffk_list_documents(): array
{
    return ffk_map_all(ffk_all('SELECT * FROM documents ORDER BY title ASC'), 'ffk_map_document');
}

function ffk_get_document(int $id): ?array
{
    return ffk_map_document(ffk_row('SELECT * FROM documents WHERE id = ?', [$id]));
}

function ffk_get_document_by_slug(string $slug): ?array
{
    return ffk_map_document(ffk_row('SELECT * FROM documents WHERE slug = ?', [$slug]));
}

function ffk_create_document(array $d): array
{
    $id = ffk_insert('documents', ffk_columns($d, FFK_DOCUMENT_FIELDS));
    return ffk_get_document($id) ?? [];
}

function ffk_update_document(int $id, array $d): ?array
{
    ffk_update('documents', $id, ffk_columns($d, FFK_DOCUMENT_FIELDS));
    return ffk_get_document($id);
}

function ffk_delete_document(int $id): void
{
    ffk_exec('DELETE FROM documents WHERE id = ?', [$id]);
}

// ---------------------------------------------------------------------------
// Einstellungen (Schlüssel/Wert)
// ---------------------------------------------------------------------------

function ffk_get_setting(string $key): ?string
{
    $r = ffk_row('SELECT `value` FROM settings WHERE `key` = ?', [$key]);
    return $r !== null ? (string) $r['value'] : null;
}

function ffk_set_setting(string $key, string $value): void
{
    ffk_exec(
        'INSERT INTO settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)',
        [$key, $value]
    );
}

// ---------------------------------------------------------------------------
// Besucherstatistik (anonyme Tagessummen)
// ---------------------------------------------------------------------------

/** Zählt einen Seitenaufruf; erhöht die Besucherzahl, wenn der Tages-Hash neu ist. */
function ffk_record_page_view(string $date, string $path, ?string $refHost, string $visitorHash, bool $isMobile): void
{
    $stmt = ffk_exec('INSERT IGNORE INTO stats_seen (date, hash) VALUES (?, ?)', [$date, $visitorHash]);
    $isNewVisitor = $stmt->rowCount() > 0;

    ffk_exec(
        'INSERT INTO stats_days (date, views, visitors, mobile) VALUES (?, 1, ?, ?)
         ON DUPLICATE KEY UPDATE views = views + 1, visitors = visitors + VALUES(visitors), mobile = mobile + VALUES(mobile)',
        [$date, $isNewVisitor ? 1 : 0, $isMobile ? 1 : 0]
    );
    ffk_exec(
        'INSERT INTO stats_pages (date, path, views) VALUES (?, ?, 1)
         ON DUPLICATE KEY UPDATE views = views + 1',
        [$date, $path]
    );
    if ($refHost !== null && $refHost !== '') {
        ffk_exec(
            'INSERT INTO stats_referrers (date, host, views) VALUES (?, ?, 1)
             ON DUPLICATE KEY UPDATE views = views + 1',
            [$date, $refHost]
        );
    }
}

/** Entfernt Tages-Hashes vergangener Tage (nur der aktuelle Tag wird gebraucht). */
function ffk_purge_stats_seen_before(string $date): void
{
    ffk_exec('DELETE FROM stats_seen WHERE date < ?', [$date]);
}

function ffk_get_stats_days(string $fromDate): array
{
    $rows = ffk_all(
        'SELECT date, views, visitors, mobile FROM stats_days WHERE date >= ? ORDER BY date',
        [$fromDate]
    );
    return array_map(static fn (array $r) => [
        'date' => (string) $r['date'],
        'views' => (int) $r['views'],
        'visitors' => (int) $r['visitors'],
        'mobile' => (int) $r['mobile'],
    ], $rows);
}

function ffk_get_stats_top_pages(string $fromDate, int $limit): array
{
    $limit = max(1, min(100, $limit));
    $rows = ffk_all(
        "SELECT path, SUM(views) AS views FROM stats_pages WHERE date >= ?
         GROUP BY path ORDER BY views DESC LIMIT $limit",
        [$fromDate]
    );
    return array_map(static fn (array $r) => [
        'path' => (string) $r['path'],
        'views' => (int) $r['views'],
    ], $rows);
}

function ffk_get_stats_top_referrers(string $fromDate, int $limit): array
{
    $limit = max(1, min(100, $limit));
    $rows = ffk_all(
        "SELECT host, SUM(views) AS views FROM stats_referrers WHERE date >= ?
         GROUP BY host ORDER BY views DESC LIMIT $limit",
        [$fromDate]
    );
    return array_map(static fn (array $r) => [
        'host' => (string) $r['host'],
        'views' => (int) $r['views'],
    ], $rows);
}
