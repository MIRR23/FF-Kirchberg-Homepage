<?php
/**
 * Datenbank-Verbindung (PDO/MariaDB) und idempotente Schema-Anlage.
 *
 * Die Tabellen werden beim ersten Aufruf automatisch angelegt und fehlende
 * Spalten nachgerüstet. „Dateien hochladen + config.php ausfüllen" genügt
 * damit als komplette Installation – ein SQL-Import ist nicht nötig.
 */

declare(strict_types=1);

defined('FFK_APP') || exit;

/**
 * Version des Schemas. Wird in settings.schema_version hinterlegt; stimmt der
 * Wert, überspringt jede weitere Anfrage die (teuren) DDL-Befehle.
 */
const FFK_SCHEMA_VERSION = '1';

/** Liefert die gemeinsame PDO-Verbindung (baut sie beim ersten Aufruf auf). */
function ffk_db(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $socket = (string) ffk_config('db_socket', '');
    $name = (string) ffk_config('db_name', '');
    if ($socket !== '') {
        $dsn = 'mysql:unix_socket=' . $socket . ';dbname=' . $name . ';charset=utf8mb4';
    } else {
        $dsn = 'mysql:host=' . (string) ffk_config('db_host', 'localhost')
            . ';port=' . (int) ffk_config('db_port', 3306)
            . ';dbname=' . $name
            . ';charset=utf8mb4';
    }

    try {
        $pdo = new PDO($dsn, (string) ffk_config('db_user', ''), (string) ffk_config('db_pass', ''), [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
            PDO::ATTR_STRINGIFY_FETCHES => false,
        ]);
    } catch (PDOException $e) {
        error_log('[FFK] Datenbankverbindung fehlgeschlagen: ' . $e->getMessage());
        ffk_fail(500, 'Die Datenbank ist nicht erreichbar. Bitte die Zugangsdaten in config.php prüfen.');
    }

    $pdo->exec("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci");
    ffk_ensure_schema($pdo);
    return $pdo;
}

/** Führt eine Abfrage mit Parametern aus. */
function ffk_exec(string $sql, array $params = []): PDOStatement
{
    $stmt = ffk_db()->prepare($sql);
    $stmt->execute($params);
    return $stmt;
}

/** Erste Zeile einer Abfrage (oder null). */
function ffk_row(string $sql, array $params = []): ?array
{
    $row = ffk_exec($sql, $params)->fetch();
    return is_array($row) ? $row : null;
}

/** Alle Zeilen einer Abfrage. */
function ffk_all(string $sql, array $params = []): array
{
    return ffk_exec($sql, $params)->fetchAll();
}

/**
 * Legt alle Tabellen an bzw. rüstet fehlende Spalten nach.
 * Läuft nur, wenn die hinterlegte Schema-Version nicht (mehr) stimmt.
 */
function ffk_ensure_schema(PDO $pdo): void
{
    try {
        $stmt = $pdo->prepare('SELECT `value` FROM settings WHERE `key` = ?');
        $stmt->execute(['schema_version']);
        $row = $stmt->fetch();
        if (is_array($row) && (string) $row['value'] === FFK_SCHEMA_VERSION) {
            return; // Schema aktuell – nichts zu tun
        }
    } catch (PDOException) {
        // Tabelle settings existiert noch nicht -> Erstinstallation, weiter unten
    }

    $opts = 'ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=DYNAMIC';
    $tables = [
        // Anmerkung: Für Spalten mit UNIQUE-/PRIMARY-Schlüssel wird VARCHAR(191)
        // statt TEXT verwendet – MariaDB erlaubt keine Schlüssel auf TEXT ohne
        // Präfixlänge. Inhaltlich entspricht das Schema 1:1 shared/schema.ts.
        "CREATE TABLE IF NOT EXISTS users (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(191) NOT NULL,
            password VARCHAR(255) NOT NULL,
            display_name VARCHAR(255) NOT NULL,
            role VARCHAR(20) NOT NULL DEFAULT 'editor',
            permissions TEXT NOT NULL,
            active TINYINT NOT NULL DEFAULT 1,
            UNIQUE KEY uq_users_username (username)
        ) $opts",
        "CREATE TABLE IF NOT EXISTS auth_tokens (
            token VARCHAR(128) NOT NULL PRIMARY KEY,
            user_id INT UNSIGNED NOT NULL,
            created_at VARCHAR(40) NOT NULL,
            KEY idx_auth_tokens_user (user_id),
            KEY idx_auth_tokens_created (created_at)
        ) $opts",
        "CREATE TABLE IF NOT EXISTS categories (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            slug VARCHAR(191) NOT NULL,
            color VARCHAR(32) NOT NULL DEFAULT 'red',
            is_einsatz TINYINT NOT NULL DEFAULT 0,
            UNIQUE KEY uq_categories_slug (slug)
        ) $opts",
        "CREATE TABLE IF NOT EXISTS posts (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            title VARCHAR(500) NOT NULL,
            slug VARCHAR(191) NOT NULL,
            content LONGTEXT NOT NULL,
            excerpt TEXT NOT NULL,
            category_id INT UNSIGNED NOT NULL,
            published_at VARCHAR(40) NOT NULL,
            featured_image VARCHAR(500) NULL,
            images TEXT NOT NULL,
            author_name VARCHAR(255) NOT NULL,
            status VARCHAR(20) NOT NULL DEFAULT 'published',
            stichwort VARCHAR(255) NULL,
            ort VARCHAR(255) NULL,
            lat DOUBLE NULL,
            lng DOUBLE NULL,
            UNIQUE KEY uq_posts_slug (slug),
            KEY idx_posts_published (published_at),
            KEY idx_posts_category (category_id),
            KEY idx_posts_status (status)
        ) $opts",
        "CREATE TABLE IF NOT EXISTS events (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            title VARCHAR(500) NOT NULL,
            date VARCHAR(20) NOT NULL,
            time VARCHAR(20) NOT NULL,
            location VARCHAR(500) NOT NULL,
            description TEXT NOT NULL,
            kind VARCHAR(32) NOT NULL DEFAULT 'veranstaltung',
            lat DOUBLE NULL,
            lng DOUBLE NULL,
            KEY idx_events_date (date)
        ) $opts",
        "CREATE TABLE IF NOT EXISTS vehicles (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            type VARCHAR(255) NOT NULL,
            description LONGTEXT NOT NULL,
            image VARCHAR(500) NULL,
            images TEXT NOT NULL,
            sort_order INT NOT NULL DEFAULT 0,
            KEY idx_vehicles_sort (sort_order)
        ) $opts",
        "CREATE TABLE IF NOT EXISTS members (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            funktion VARCHAR(255) NOT NULL,
            gruppe VARCHAR(50) NOT NULL DEFAULT 'aktive',
            image VARCHAR(500) NULL,
            sort_order INT NOT NULL DEFAULT 0,
            KEY idx_members_sort (sort_order)
        ) $opts",
        "CREATE TABLE IF NOT EXISTS pages (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            slug VARCHAR(191) NOT NULL,
            title VARCHAR(255) NOT NULL,
            content LONGTEXT NOT NULL,
            updated_at VARCHAR(40) NOT NULL,
            UNIQUE KEY uq_pages_slug (slug)
        ) $opts",
        "CREATE TABLE IF NOT EXISTS documents (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            slug VARCHAR(191) NOT NULL,
            title VARCHAR(255) NOT NULL,
            filename VARCHAR(255) NOT NULL,
            original_name VARCHAR(255) NOT NULL,
            mime_type VARCHAR(150) NOT NULL,
            size BIGINT NOT NULL DEFAULT 0,
            updated_at VARCHAR(40) NOT NULL,
            updated_by VARCHAR(255) NOT NULL,
            UNIQUE KEY uq_documents_slug (slug)
        ) $opts",
        "CREATE TABLE IF NOT EXISTS settings (
            `key` VARCHAR(191) NOT NULL PRIMARY KEY,
            `value` LONGTEXT NOT NULL
        ) $opts",
        // Anonyme Besucherstatistik: nur Tagessummen, keine personenbezogenen
        // Daten. stats_seen enthält Tages-Hashes (täglich wechselndes Salt) nur
        // zur Dublettenerkennung und wird beim Tageswechsel geleert.
        "CREATE TABLE IF NOT EXISTS stats_days (
            date VARCHAR(10) NOT NULL PRIMARY KEY,
            views INT NOT NULL DEFAULT 0,
            visitors INT NOT NULL DEFAULT 0,
            mobile INT NOT NULL DEFAULT 0
        ) $opts",
        "CREATE TABLE IF NOT EXISTS stats_pages (
            date VARCHAR(10) NOT NULL,
            path VARCHAR(191) NOT NULL,
            views INT NOT NULL DEFAULT 0,
            PRIMARY KEY (date, path)
        ) $opts",
        "CREATE TABLE IF NOT EXISTS stats_referrers (
            date VARCHAR(10) NOT NULL,
            host VARCHAR(191) NOT NULL,
            views INT NOT NULL DEFAULT 0,
            PRIMARY KEY (date, host)
        ) $opts",
        "CREATE TABLE IF NOT EXISTS stats_seen (
            date VARCHAR(10) NOT NULL,
            hash CHAR(64) NOT NULL,
            PRIMARY KEY (date, hash)
        ) $opts",
        "CREATE TABLE IF NOT EXISTS media (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            filename VARCHAR(255) NOT NULL,
            url VARCHAR(500) NOT NULL,
            title VARCHAR(500) NOT NULL,
            uploaded_at VARCHAR(40) NOT NULL,
            uploaded_by VARCHAR(255) NOT NULL
        ) $opts",
        // Rate-Limit für die Anmeldung (ersetzt express-rate-limit; muss ohne
        // dauerhaften Prozess funktionieren, deshalb in der Datenbank).
        "CREATE TABLE IF NOT EXISTS login_attempts (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            ip VARCHAR(45) NOT NULL,
            attempted_at INT UNSIGNED NOT NULL,
            KEY idx_login_attempts (ip, attempted_at)
        ) $opts",
    ];

    foreach ($tables as $sql) {
        $pdo->exec($sql);
    }

    // Spalten-Nachzüge für bestehende Datenbanken (CREATE TABLE IF NOT EXISTS
    // ergänzt keine neuen Spalten in bereits vorhandenen Tabellen)
    ffk_ensure_column($pdo, 'posts', 'lat', 'lat DOUBLE NULL');
    ffk_ensure_column($pdo, 'posts', 'lng', 'lng DOUBLE NULL');
    ffk_ensure_column($pdo, 'events', 'lat', 'lat DOUBLE NULL');
    ffk_ensure_column($pdo, 'events', 'lng', 'lng DOUBLE NULL');

    $stmt = $pdo->prepare(
        'INSERT INTO settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)'
    );
    $stmt->execute(['schema_version', FFK_SCHEMA_VERSION]);
}

/** Ergänzt eine Spalte, falls sie in der Tabelle noch fehlt. */
function ffk_ensure_column(PDO $pdo, string $table, string $column, string $ddl): void
{
    $stmt = $pdo->prepare(
        'SELECT COUNT(*) AS n FROM information_schema.columns
         WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?'
    );
    $stmt->execute([$table, $column]);
    $row = $stmt->fetch();
    if ((int) ($row['n'] ?? 0) === 0) {
        $pdo->exec("ALTER TABLE `$table` ADD COLUMN $ddl");
    }
}
