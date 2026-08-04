<?php
/**
 * Front-Controller für alle API-Endpunkte.
 *
 * Adressierung (beide Varianten funktionieren gleichwertig):
 *   /api.php/posts/slug/mein-beitrag      ← über PATH_INFO
 *   /api.php?r=/posts/slug/mein-beitrag   ← über Query-Parameter
 *
 * Das Frontend nutzt die Query-Variante, weil sie auf jedem Server ohne
 * zusätzliche Konfiguration funktioniert (Managed Hosting ohne Rewrites).
 * Ein vorangestelltes „/api" wird toleriert – falls der Hoster später doch
 * hübsche Adressen (/api/…) per Rewrite auf diese Datei leitet.
 */

declare(strict_types=1);

require_once __DIR__ . '/php/bootstrap.php';
require_once __DIR__ . '/php/routes.php';
require_once __DIR__ . '/php/migrate.php';

// API-Antworten nie zwischenspeichern
header('Cache-Control: no-store, no-cache, must-revalidate');

// ---------- Pfad ermitteln ----------
$path = '';
if (isset($_SERVER['PATH_INFO']) && is_string($_SERVER['PATH_INFO']) && $_SERVER['PATH_INFO'] !== '') {
    $path = $_SERVER['PATH_INFO'];
} elseif (isset($_GET['r']) && is_string($_GET['r'])) {
    $path = $_GET['r'];
}
$path = '/' . ltrim(trim($path), '/');
$path = explode('?', $path)[0];
// Doppelte Schrägstriche und "." / ".." abwehren
$path = preg_replace('#/+#', '/', $path) ?? '/';
if (str_contains($path, '..')) {
    ffk_fail(400, 'Ungültige Adresse.');
}
// Optionales /api-Präfix entfernen (falls per Rewrite hierher geleitet)
if ($path === '/api') {
    $path = '/';
} elseif (str_starts_with($path, '/api/')) {
    $path = substr($path, 4);
}
if ($path !== '/') {
    $path = rtrim($path, '/');
}

// ---------- Methode ermitteln ----------
// Manche Managed-Hosting-Konfigurationen lassen PATCH/PUT/DELETE nicht durch
// und PHP wertet multipart-Daten nur bei POST aus. Deshalb darf der Client
// solche Anfragen als POST mit _method-Angabe senden.
$method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));
if ($method === 'POST') {
    $override = $_GET['_method'] ?? $_POST['_method'] ?? $_SERVER['HTTP_X_HTTP_METHOD_OVERRIDE'] ?? '';
    $override = is_string($override) ? strtoupper(trim($override)) : '';
    if (in_array($override, ['PATCH', 'PUT', 'DELETE'], true)) {
        $method = $override;
    }
}

// ---------- Erstinstallation / Datenbank vorbereiten ----------
ffk_ensure_installed();

// ---------- Anfrage bearbeiten ----------
ffk_handle_request($method, $path);
