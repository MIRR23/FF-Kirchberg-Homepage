<?php
/**
 * Stabiler Datei-Link: /datei.php?s=<slug> liefert immer die aktuell
 * hinterlegte Datei aus. Beim Austauschen der Datei bleibt der Link
 * unverändert gültig – verlinkte Dokumente (Organigramm, Übungsplan …)
 * müssen nie neu verlinkt werden.
 *
 * Entspricht der bisherigen Route GET /dateien/:slug.
 */

declare(strict_types=1);

require_once __DIR__ . '/php/bootstrap.php';

/** Beendet die Anfrage mit einer schlichten Fehlerseite. */
function ffk_file_not_found(): never
{
    http_response_code(404);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['message' => 'Datei nicht gefunden'], JSON_UNESCAPED_UNICODE);
    exit;
}

// Slug wahlweise aus ?s=… oder aus PATH_INFO (/datei.php/mein-dokument)
$slug = '';
if (isset($_GET['s']) && is_string($_GET['s'])) {
    $slug = $_GET['s'];
} elseif (isset($_SERVER['PATH_INFO']) && is_string($_SERVER['PATH_INFO'])) {
    $slug = trim($_SERVER['PATH_INFO'], '/');
}
$slug = trim($slug);
if ($slug === '' || preg_match('/^[A-Za-z0-9._-]+$/', $slug) !== 1) {
    ffk_file_not_found();
}

$doc = ffk_get_document_by_slug($slug);
if ($doc === null) {
    ffk_file_not_found();
}

$fp = FFK_DOC_DIR . '/' . basename($doc['filename']);
if (!is_file($fp) || !ffk_path_within(FFK_DOC_DIR, $fp)) {
    ffk_file_not_found();
}

// Nicht cachen: hinter dem Link kann jederzeit eine neue Version liegen
header('Cache-Control: no-cache');
header('Content-Type: ' . $doc['mimeType']);
header('Content-Length: ' . (string) filesize($fp));

// PDFs und Bilder direkt im Browser anzeigen, alles andere herunterladen
$inline = $doc['mimeType'] === 'application/pdf' || str_starts_with($doc['mimeType'], 'image/');
$name = $doc['originalName'] !== '' ? $doc['originalName'] : $doc['filename'];

$asciiName = $name;
if (class_exists('Normalizer')) {
    $normalized = Normalizer::normalize($name, Normalizer::FORM_KD);
    if (is_string($normalized)) {
        $asciiName = $normalized;
    }
}
$asciiName = preg_replace('/[^\x20-\x7E]/', '_', $asciiName) ?? 'datei';
$asciiName = preg_replace('/["\\\\]/', '_', $asciiName) ?? 'datei';

header(sprintf(
    'Content-Disposition: %s; filename="%s"; filename*=UTF-8\'\'%s',
    $inline ? 'inline' : 'attachment',
    $asciiName,
    rawurlencode($name)
));

// Ausgabepuffer leeren, damit große Dateien nicht komplett in den Speicher gehen
while (ob_get_level() > 0) {
    ob_end_clean();
}
readfile($fp);
