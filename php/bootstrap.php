<?php
/**
 * Gemeinsamer Start für alle PHP-Einstiegspunkte (api.php, datei.php).
 *
 * Lädt die Konfiguration, setzt Sicherheits-Header und Fehlerbehandlung und
 * stellt die Pfade bereit. Wird von jeder PHP-Datei zuerst eingebunden.
 */

declare(strict_types=1);

// Direkter Aufruf der Bibliotheksdateien über den Browser bringt nichts:
// Sie definieren nur Funktionen. FFK_APP markiert den regulären Weg.
define('FFK_APP', true);

/** Wurzelverzeichnis der Installation (dort liegen api.php, index.html, uploads/). */
define('FFK_ROOT', dirname(__DIR__));
define('FFK_UPLOAD_DIR', FFK_ROOT . '/uploads');
define('FFK_DOC_DIR', FFK_UPLOAD_DIR . '/dokumente');

/** Gültigkeitsdauer einer Anmeldung: 30 Tage (wie in der bisherigen Fassung). */
define('FFK_TOKEN_TTL', 30 * 24 * 60 * 60);

date_default_timezone_set('Europe/Berlin');
mb_internal_encoding('UTF-8');

// ---------- Konfiguration laden ----------
// Regulär liegt config.php neben index.html. Wer sie zusätzlich absichern will,
// kann sie stattdessen eine Ebene ÜBER dem Web-Ordner ablegen – dann kommt sie
// selbst dann nicht ins Netz, wenn PHP einmal nicht ausgeführt würde.
$ffkConfigFile = FFK_ROOT . '/config.php';
if (!is_file($ffkConfigFile) && is_file(dirname(FFK_ROOT) . '/config.php')) {
    $ffkConfigFile = dirname(FFK_ROOT) . '/config.php';
}
if (!is_file($ffkConfigFile)) {
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'message' => 'Die Datei config.php fehlt. Bitte config.example.php kopieren, '
            . 'in config.php umbenennen und die Datenbank-Zugangsdaten eintragen.',
    ], JSON_UNESCAPED_UNICODE);
    exit;
}
/** @var array<string,mixed> $ffkConfigRaw */
$ffkConfigRaw = require $ffkConfigFile;
if (!is_array($ffkConfigRaw)) {
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['message' => 'config.php ist fehlerhaft (es muss ein Array zurückgegeben werden).'], JSON_UNESCAPED_UNICODE);
    exit;
}

$GLOBALS['FFK_CONFIG'] = $ffkConfigRaw + [
    'db_host' => 'localhost',
    'db_port' => 3306,
    'db_name' => '',
    'db_user' => '',
    'db_pass' => '',
    'db_socket' => '',
    'app_env' => 'production',
    'auto_migrate' => true,
];

/** Liest einen Konfigurationswert. */
function ffk_config(string $key, mixed $default = null): mixed
{
    return $GLOBALS['FFK_CONFIG'][$key] ?? $default;
}

/** true, wenn die Installation im Entwicklungsmodus läuft (ausführliche Fehler). */
function ffk_is_dev(): bool
{
    return ffk_config('app_env') === 'development';
}

// ---------- Fehlerbehandlung ----------
// Besucher bekommen niemals Interna (Pfade, SQL, Stacktraces) zu sehen;
// Details landen ausschließlich im Server-Fehlerprotokoll.
ini_set('display_errors', ffk_is_dev() ? '1' : '0');
ini_set('log_errors', '1');
error_reporting(E_ALL);

/** Beendet die Anfrage mit einer JSON-Fehlermeldung (deutsch, ohne Interna). */
function ffk_fail(int $status, string $message): never
{
    if (!headers_sent()) {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
    }
    echo json_encode(['message' => $message], JSON_UNESCAPED_UNICODE);
    exit;
}

set_exception_handler(static function (Throwable $e): void {
    error_log('[FFK] ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
    $detail = ffk_is_dev() ? ' (' . $e->getMessage() . ')' : '';
    ffk_fail(500, 'Es ist ein interner Fehler aufgetreten.' . $detail);
});

set_error_handler(static function (int $severity, string $message, string $file = '', int $line = 0): bool {
    if (!(error_reporting() & $severity)) {
        return false; // per @ unterdrückt oder ausgeblendet
    }
    // Veraltungshinweise dürfen den Ablauf NIE unterbrechen. Sie sagen nur,
    // dass eine Funktion in einer künftigen PHP-Fassung wegfällt – die
    // Anwendung funktioniert weiterhin. Würden sie wie Fehler behandelt,
    // bräche eine neue PHP-Version schlagartig Funktionen ab (so geschehen
    // mit imagedestroy() unter PHP 8.5 beim Hochladen von Bildern).
    if ($severity === E_DEPRECATED || $severity === E_USER_DEPRECATED) {
        error_log('[FFK] Veraltungshinweis: ' . $message . ' @ ' . $file . ':' . $line);
        return true; // erledigt, kein Abbruch
    }
    throw new ErrorException($message, 0, $severity, $file, $line);
});

// ---------- Sicherheits-Header ----------
// Entsprechen den bisher von helmet gesetzten Vorgaben.
if (!headers_sent()) {
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: SAMEORIGIN');
    header('Referrer-Policy: no-referrer');
    header('Cross-Origin-Opener-Policy: same-origin');
    header('X-DNS-Prefetch-Control: off');
    header('X-Download-Options: noopen');
    header('X-Permitted-Cross-Domain-Policies: none');
    header('Strict-Transport-Security: max-age=15552000; includeSubDomains');
    header_remove('X-Powered-By');
}

require_once __DIR__ . '/util.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/storage.php';
require_once __DIR__ . '/auth.php';
