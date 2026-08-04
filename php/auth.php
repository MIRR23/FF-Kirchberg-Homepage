<?php
/**
 * Anmeldung, Token-Verwaltung und Berechtigungsprüfung
 * (Portierung von server/auth.ts).
 *
 * Passwörter werden mit password_hash()/password_verify() gespeichert.
 * Die alten scrypt-Hashes der Node-Fassung sind bewusst nicht übertragbar –
 * die Erstbefüllung legt die Benutzer wie bisher neu an.
 */

declare(strict_types=1);

defined('FFK_APP') || exit;

/** Erzeugt einen Passwort-Hash (bcrypt/argon2 – vom PHP-Standard vorgegeben). */
function ffk_hash_password(string $password): string
{
    return password_hash($password, PASSWORD_DEFAULT);
}

/** Prüft ein Passwort gegen den gespeicherten Hash. */
function ffk_verify_password(string $password, string $stored): bool
{
    if ($stored === '') {
        return false;
    }
    return password_verify($password, $stored);
}

/** Neues, zufälliges Anmelde-Token (64 Hex-Zeichen wie bisher). */
function ffk_new_token(): string
{
    return bin2hex(random_bytes(32));
}

/** Stichtag: Tokens, die davor erzeugt wurden, sind abgelaufen. */
function ffk_token_cutoff_iso(): string
{
    return ffk_iso_ago(FFK_TOKEN_TTL);
}

/** Entfernt das Passwort-Feld aus einem Benutzerdatensatz. */
function ffk_safe_user(array $user): array
{
    unset($user['password']);
    return $user;
}

/**
 * Liefert den angemeldeten Benutzer oder beendet die Anfrage mit 401.
 * Das Ergebnis wird zwischengespeichert (mehrfacher Aufruf ist billig).
 */
function ffk_require_auth(): array
{
    static $current = null;
    if ($current !== null) {
        return $current;
    }

    $token = ffk_bearer_token();
    if ($token === null) {
        ffk_fail(401, 'Nicht angemeldet');
    }
    $t = ffk_get_token($token);
    if ($t === null) {
        ffk_fail(401, 'Sitzung abgelaufen');
    }
    if ($t['createdAt'] < ffk_token_cutoff_iso()) {
        ffk_delete_token($token);
        ffk_fail(401, 'Sitzung abgelaufen – bitte erneut anmelden');
    }
    $user = ffk_get_user($t['userId']);
    if ($user === null || $user['active'] === 0) {
        ffk_fail(401, 'Benutzer inaktiv');
    }
    $current = ffk_safe_user($user);
    return $current;
}

/** Prüft, ob ein Benutzer den Bereich bearbeiten darf (Admin darf alles). */
function ffk_has_permission(array $user, string $area): bool
{
    if (($user['role'] ?? '') === 'admin') {
        return true;
    }
    $perms = json_decode((string) ($user['permissions'] ?? '[]'), true);
    return is_array($perms) && in_array($area, $perms, true);
}

/** Erzwingt eine Bereichsberechtigung (sonst 403). */
function ffk_require_permission(array $user, string $area): void
{
    if (!ffk_has_permission($user, $area)) {
        ffk_fail(403, 'Keine Berechtigung für diesen Bereich');
    }
}

/** Erzwingt Administrator-Rechte (sonst 403). */
function ffk_require_admin(array $user): void
{
    if (($user['role'] ?? '') !== 'admin') {
        ffk_fail(403, 'Nur für Administratoren');
    }
}

// ---------------------------------------------------------------------------
// Rate-Limit für die Anmeldung
// ---------------------------------------------------------------------------

/** Zeitfenster und maximale Anmeldeversuche je IP (wie bisher: 20 / 15 Minuten). */
const FFK_LOGIN_WINDOW = 15 * 60;
const FFK_LOGIN_LIMIT = 20;

/**
 * Zählt einen Anmeldeversuch und bricht ab, wenn zu viele Versuche von
 * derselben IP-Adresse kommen. Ersetzt express-rate-limit; die Zählung liegt
 * in der Datenbank, weil PHP keinen dauerhaften Prozessspeicher hat.
 */
function ffk_check_login_rate_limit(): void
{
    $ip = ffk_client_ip();
    $now = time();

    // Abgelaufene Einträge aufräumen (hält die Tabelle klein)
    ffk_exec('DELETE FROM login_attempts WHERE attempted_at < ?', [$now - FFK_LOGIN_WINDOW]);
    ffk_exec('INSERT INTO login_attempts (ip, attempted_at) VALUES (?, ?)', [$ip, $now]);

    $row = ffk_row(
        'SELECT COUNT(*) AS n FROM login_attempts WHERE ip = ? AND attempted_at >= ?',
        [$ip, $now - FFK_LOGIN_WINDOW]
    );
    if ((int) ($row['n'] ?? 0) > FFK_LOGIN_LIMIT) {
        ffk_fail(429, 'Zu viele Anmeldeversuche. Bitte in 15 Minuten erneut versuchen.');
    }
}
