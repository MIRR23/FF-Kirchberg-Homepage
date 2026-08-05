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

echo "Bildverarbeitung dieses Servers: " . json_encode(ffk_image_capabilities()) . "\n";

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
imagedestroy($im);
@exec('exiftool -overwrite_original -q -GPSLatitude=48.3 -GPSLatitudeRef=N '
    . '-Make=TestPhone -Artist=Vertraulich -Orientation#=6 ' . escapeshellarg($src));
pruefe('Testfoto angelegt', is_file($src) && filesize($src) > 0);

// ---------------------------------------------------------------------------
echo "\n▶ Jedes Ausgabeformat einzeln\n";
$can = ffk_image_capabilities();
foreach ([['webp', 'image/webp'], ['jpeg', 'image/jpeg'], ['png', 'image/png']] as [$format, $mime]) {
    if (!$can[$format]) {
        echo "  – $format wird von diesem Server nicht unterstützt, übersprungen\n";
        continue;
    }
    $dest = "$tmp/out.$format";
    @unlink($dest);
    $ok = $can['engine'] === 'imagick'
        ? ffk_optimize_with_imagick($src, $dest, $format)
        : ffk_optimize_with_gd($src, $dest, IMAGETYPE_JPEG, $format);
    $info = is_file($dest) ? @getimagesize($dest) : false;

    pruefe("$format wird geschrieben", $ok && $info !== false && $info['mime'] === $mime,
        $info ? "{$info[0]}x{$info[1]}" : 'keine Datei');
    if ($info === false) {
        continue;
    }
    pruefe("$format: auf 1600 px begrenzt", max($info[0], $info[1]) === 1600, "{$info[0]}x{$info[1]}");
    pruefe("$format: EXIF-Drehung angewendet", $info[1] > $info[0], "{$info[0]}x{$info[1]}");
    $meta = metadaten($dest);
    if ($meta === null) {
        echo "  – Metadatenprüfung übersprungen (exiftool fehlt)\n";
    } else {
        pruefe("$format: GPS und Kameradaten entfernt",
            preg_match('/GPS|TestPhone|Vertraulich/i', $meta) !== 1);
    }
}

// ---------------------------------------------------------------------------
echo "\n▶ Formatwahl\n";
pruefe('bevorzugt WebP, wenn der Server es kann',
    !$can['webp'] || ffk_image_target_format(false) === 'webp');
pruefe('weicht ohne WebP auf JPEG oder PNG aus',
    $can['webp'] || in_array(ffk_image_target_format(false), ['jpeg', 'png'], true));

// ---------------------------------------------------------------------------
echo "\n▶ Transparenz\n";
if ($can['jpeg']) {
    $png = "$tmp/transparent.png";
    $t = imagecreatetruecolor(400, 300);
    imagesavealpha($t, true);
    imagefill($t, 0, 0, imagecolorallocatealpha($t, 0, 0, 0, 127));
    imagepng($t, $png);
    imagedestroy($t);
    $dest = "$tmp/flach.jpg";
    $ok = $can['engine'] === 'imagick'
        ? ffk_optimize_with_imagick($png, $dest, 'jpeg')
        : ffk_optimize_with_gd($png, $dest, IMAGETYPE_PNG, 'jpeg');
    pruefe('durchsichtiges PNG wird als JPEG gespeichert', $ok && is_file($dest) && filesize($dest) > 0);
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
