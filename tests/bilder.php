<?php
/**
 * Prüft die Bildverarbeitung – auch die Wege, die auf diesem Rechner nicht
 * automatisch auftreten.
 *
 * Hintergrund: Nicht jeder Server kann WebP schreiben (GD wird bei manchen
 * Hostern ohne WebP übersetzt). Dann muss der Upload trotzdem funktionieren
 * und auf JPEG bzw. PNG ausweichen. Dieser Test ruft die Kodierer deshalb
 * einzeln mit jedem Format auf.
 *
 * Aufruf (braucht config.php im Projektordner):
 *   php tests/bilder.php
 */

declare(strict_types=1);

require dirname(__DIR__) . '/php/bootstrap.php';
require FFK_ROOT . '/php/images.php';

$tmp = sys_get_temp_dir() . '/ffk-bildtest-' . getmypid();
@mkdir($tmp, 0775, true);

$bestanden = 0;
$fehler = [];

function pruefe(string $name, bool $bedingung, string $detail = ''): void
{
    global $bestanden, $fehler;
    if ($bedingung) {
        $bestanden++;
        echo "  ✓ $name" . ($detail ? " – $detail" : '') . "\n";
    } else {
        $fehler[] = $name . ($detail ? " – $detail" : '');
        echo "  ✗ $name" . ($detail ? " – $detail" : '') . "\n";
    }
}

/** Liest Metadaten, falls exiftool vorhanden ist. */
function metadaten(string $datei): ?string
{
    $out = @shell_exec('exiftool -s -G ' . escapeshellarg($datei) . ' 2>/dev/null');
    return is_string($out) && $out !== '' ? $out : null;
}

echo "Bildverarbeitung dieses Servers: " . ffk_image_capabilities_text() . "\n";
echo "Im Detail: " . json_encode(ffk_image_capabilities()) . "\n";

// ---------------------------------------------------------------------------
echo "\n▶ Testfoto erzeugen (2400x1600, EXIF-Drehung und GPS)\n";
$src = "$tmp/foto.jpg";
$im = imagecreatetruecolor(2400, 1600);
for ($y = 0; $y < 1600; $y += 8) {
    for ($x = 0; $x < 2400; $x += 8) {
        imagefilledrectangle($im, $x, $y, $x + 7, $y + 7,
            imagecolorallocate($im, (int) ($x * 255 / 2400), (int) ($y * 255 / 1600), 70));
    }
}
imagejpeg($im, $src, 90);
@exec('exiftool -overwrite_original -q -GPSLatitude=48.3 -GPSLatitudeRef=N '
    . '-Make=TestPhone -Artist=Vertraulich -Orientation#=6 ' . escapeshellarg($src));
pruefe('Testfoto angelegt', is_file($src) && filesize($src) > 0);

// ---------------------------------------------------------------------------
echo "\n▶ Jedes Ausgabeformat einzeln, mit jeder vorhandenen Bibliothek\n";
$can = ffk_image_capabilities();
foreach ($can['engines'] as $engine) {
  foreach ([['webp', 'image/webp'], ['jpeg', 'image/jpeg'], ['png', 'image/png']] as [$format, $mime]) {
    if (!$can[$engine][$format]) {
        echo "  – $engine/$format wird von diesem Server nicht unterstützt, übersprungen\n";
        continue;
    }
    $dest = "$tmp/out-$engine.$format";
    @unlink($dest);
    $fehlgeschlagen = null;
    try {
        if ($engine === 'imagick') {
            ffk_optimize_with_imagick($src, $dest, $format);
        } else {
            ffk_optimize_with_gd($src, $dest, IMAGETYPE_JPEG, $format);
        }
    } catch (Throwable $e) {
        $fehlgeschlagen = $e->getMessage();
    }
    $info = is_file($dest) ? @getimagesize($dest) : false;

    pruefe("$engine/$format wird geschrieben",
        $fehlgeschlagen === null && $info !== false && $info['mime'] === $mime,
        $fehlgeschlagen ?? ($info ? "{$info[0]}x{$info[1]}" : 'keine Datei'));
    if ($info === false) {
        continue;
    }
    pruefe("$engine/$format: auf 1600 px begrenzt", max($info[0], $info[1]) === 1600, "{$info[0]}x{$info[1]}");
    pruefe("$engine/$format: EXIF-Drehung angewendet", $info[1] > $info[0], "{$info[0]}x{$info[1]}");
    $meta = metadaten($dest);
    if ($meta === null) {
        echo "  – Metadatenprüfung übersprungen (exiftool fehlt)\n";
    } else {
        pruefe("$engine/$format: GPS und Kameradaten entfernt",
            preg_match('/GPS|TestPhone|Vertraulich/i', $meta) !== 1);
    }
  }
}

// ---------------------------------------------------------------------------
echo "\n▶ Formatwahl\n";
foreach ($can['engines'] as $engine) {
    $reihenfolge = ffk_image_target_formats($engine, false);
    pruefe("$engine: bevorzugt WebP, wenn möglich",
        !$can[$engine]['webp'] || ($reihenfolge[0] ?? '') === 'webp', implode(' > ', $reihenfolge));
    pruefe("$engine: hat mindestens ein Ausgabeformat", $reihenfolge !== [], implode(' > ', $reihenfolge));
    $mitTransparenz = ffk_image_target_formats($engine, true);
    pruefe("$engine: PNG vor JPEG bei Transparenz",
        !$can[$engine]['png'] || !$can[$engine]['jpeg']
        || array_search('png', $mitTransparenz, true) < array_search('jpeg', $mitTransparenz, true),
        implode(' > ', $mitTransparenz));
}

// ---------------------------------------------------------------------------
echo "\n▶ Transparenz\n";
$engine = $can['engines'][0] ?? 'gd';
if ($can[$engine]['jpeg']) {
    $png = "$tmp/transparent.png";
    $t = imagecreatetruecolor(400, 300);
    imagesavealpha($t, true);
    imagefill($t, 0, 0, imagecolorallocatealpha($t, 0, 0, 0, 127));
    imagepng($t, $png);
    $dest = "$tmp/flach.jpg";
    $fehler2 = null;
    try {
        if ($engine === 'imagick') {
            ffk_optimize_with_imagick($png, $dest, 'jpeg');
        } else {
            ffk_optimize_with_gd($png, $dest, IMAGETYPE_PNG, 'jpeg');
        }
    } catch (Throwable $e) {
        $fehler2 = $e->getMessage();
    }
    pruefe('durchsichtiges PNG wird als JPEG gespeichert',
        $fehler2 === null && is_file($dest) && filesize($dest) > 0, (string) $fehler2);
}

// ---------------------------------------------------------------------------
echo "\n▶ Grenzfälle\n";
$altesLimit = ini_get('memory_limit');
ini_set('memory_limit', '32M');
$meldung = null;
try {
    ffk_check_memory_for_image(6000, 4000);
} catch (FfkImageException $e) {
    $meldung = $e->getMessage();
}
ini_set('memory_limit', (string) $altesLimit);
pruefe('zu großes Foto wird vor dem Absturz erkannt', $meldung !== null);
pruefe('Meldung nennt memory_limit', $meldung !== null && str_contains($meldung, 'memory_limit'));

$meldung = null;
try {
    ffk_check_memory_for_image(800, 600);
} catch (FfkImageException $e) {
    $meldung = $e->getMessage();
}
pruefe('normales Foto läuft durch', $meldung === null);

file_put_contents("$tmp/kein-bild.jpg", 'das ist kein Bild');
$meldung = null;
try {
    ffk_optimize_image("$tmp/kein-bild.jpg", 'image/jpeg');
} catch (FfkImageException $e) {
    $meldung = $e->getMessage();
}
pruefe('Textdatei mit .jpg wird abgelehnt', $meldung !== null, (string) $meldung);

$gif = "$tmp/anim.gif";
imagegif(imagecreatetruecolor(60, 40), $gif);
pruefe('GIF bleibt unverändert (Animation)', ffk_optimize_image($gif, 'image/gif') === $gif);

// ---------------------------------------------------------------------------
// Neue PHP-Fassungen dürfen den Upload nicht lahmlegen
//
// PHP 8.5 meldet imagedestroy() als veraltet. Solange solche Hinweise wie
// Fehler behandelt wurden, brach der Bild-Upload auf einem frisch
// aktualisierten Server komplett ab. Der Test hält das dauerhaft fest.
echo "\n▶ Veraltungshinweise legen nichts lahm\n";

$altesLog = ini_get('error_log');
ini_set('error_log', "$tmp/hinweise.log"); // Protokoll aus der Testausgabe halten
$abbruch = null;
try {
    trigger_error('nur ein Hinweis', E_USER_DEPRECATED);
} catch (Throwable $e) {
    $abbruch = $e->getMessage();
}
pruefe('Veraltungshinweis bricht nicht ab', $abbruch === null, (string) $abbruch);
pruefe(
    'Veraltungshinweis steht im Server-Protokoll',
    str_contains((string) @file_get_contents("$tmp/hinweise.log"), 'nur ein Hinweis')
);
ini_set('error_log', $altesLog === false ? '' : $altesLog);

$abbruch = null;
try {
    trigger_error('echter Fehler', E_USER_WARNING);
} catch (Throwable $e) {
    $abbruch = $e->getMessage();
}
pruefe('echte Warnung bricht weiterhin ab', $abbruch !== null);

// Imagick-Fassungen vor 3.3 kennen autoOrientImage() nicht. Der Aufruf läuft
// deshalb über eine Hilfsfunktion, die die Drehung notfalls selbst erledigt.
$imagesQuelle = file_get_contents(FFK_ROOT . '/php/images.php') ?: '';
pruefe('EXIF-Drehung über eigene Hilfsfunktion', function_exists('ffk_imagick_auto_orient'));
pruefe(
    'autoOrientImage() nur einmal, in der abgesicherten Hilfsfunktion',
    substr_count($imagesQuelle, '->autoOrientImage()') === 1
    && str_contains($imagesQuelle, "method_exists(\$im, 'autoOrientImage')")
);

// ---------------------------------------------------------------------------
array_map('unlink', glob("$tmp/*") ?: []);
@rmdir($tmp);

echo "\n" . str_repeat('=', 60) . "\n";
echo "Bestanden: $bestanden   Fehlgeschlagen: " . count($fehler) . "\n";
if ($fehler !== []) {
    foreach ($fehler as $f) {
        echo "  ✗ $f\n";
    }
    exit(1);
}
echo "Alle Prüfungen bestanden.\n";
