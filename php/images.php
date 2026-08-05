<?php
/**
 * Bildverarbeitung beim Upload – Parität zu optimizeImage() in server/routes.ts.
 *
 * Hochgeladene Fotos werden fürs Web aufbereitet:
 *   • EXIF-Drehung anwenden (Hochformat-Fotos vom Handy stehen richtig)
 *   • auf maximal 1600 px längste Kante begrenzen (nie vergrößern)
 *   • als WebP mit Qualität 82 neu kodieren
 *   • sämtliche Metadaten entfernen – insbesondere die GPS-Position
 *   • animierte GIFs unverändert lassen (Animation bliebe sonst auf der Strecke)
 *
 * Bevorzugt wird die Imagick-Erweiterung; ist sie nicht vorhanden, übernimmt GD
 * (auf dem Zielserver mindestens verfügbar). Beides wird zur Laufzeit erkannt.
 */

declare(strict_types=1);

defined('FFK_APP') || exit;

const FFK_IMAGE_MAX_EDGE = 1600;
const FFK_IMAGE_WEBP_QUALITY = 82;

/** Erlaubte Bild-Typen beim Upload (wie bisher der multer-fileFilter). */
const FFK_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif'];

/** true, wenn Imagick nutzbar ist. */
function ffk_has_imagick(): bool
{
    return extension_loaded('imagick') && class_exists('Imagick');
}

/** true, wenn GD nutzbar ist. */
function ffk_has_gd(): bool
{
    return extension_loaded('gd') && function_exists('imagecreatetruecolor');
}

/** Die hochgeladene Datei ließ sich nicht verarbeiten (mit deutscher Begründung). */
final class FfkImageException extends RuntimeException
{
}

/**
 * Was kann dieser Server? Ermittelt für **beide** Bibliotheken getrennt, was
 * sie schreiben können – eine kaputt konfigurierte Imagick-Installation darf
 * nicht dazu führen, dass gar nichts mehr geht.
 *
 * @return array{engines:list<string>,imagick:array{webp:bool,jpeg:bool,png:bool},gd:array{webp:bool,jpeg:bool,png:bool}}
 */
function ffk_image_capabilities(): array
{
    static $cache = null;
    if ($cache !== null) {
        return $cache;
    }

    $engines = [];
    $imagick = ['webp' => false, 'jpeg' => false, 'png' => false];
    $gd = ['webp' => false, 'jpeg' => false, 'png' => false];

    if (ffk_has_imagick()) {
        $engines[] = 'imagick';
        try {
            $formate = array_map('strtoupper', Imagick::queryFormats());
            $imagick = [
                'webp' => in_array('WEBP', $formate, true),
                'jpeg' => in_array('JPEG', $formate, true),
                'png' => in_array('PNG', $formate, true),
            ];
        } catch (Throwable) {
            // Formate nicht abfragbar – trotzdem versuchen, es kann klappen
            $imagick = ['webp' => true, 'jpeg' => true, 'png' => true];
        }
    }

    if (ffk_has_gd()) {
        $engines[] = 'gd';
        $info = function_exists('gd_info') ? gd_info() : [];
        $gd = [
            'webp' => function_exists('imagewebp') && !empty($info['WebP Support']),
            'jpeg' => function_exists('imagejpeg') && !empty($info['JPEG Support']),
            'png' => function_exists('imagepng') && !empty($info['PNG Support']),
        ];
    }

    $cache = ['engines' => $engines, 'imagick' => $imagick, 'gd' => $gd];
    return $cache;
}

/** Kurzfassung der Server-Fähigkeiten für Fehlermeldungen und Diagnose. */
function ffk_image_capabilities_text(): string
{
    $can = ffk_image_capabilities();
    if ($can['engines'] === []) {
        return 'keine Bildbearbeitung installiert';
    }
    $teile = [];
    foreach ($can['engines'] as $engine) {
        $formate = array_keys(array_filter($can[$engine]));
        $teile[] = $engine . ': ' . ($formate === [] ? 'kein Ausgabeformat' : implode('/', $formate));
    }
    return implode(', ', $teile);
}

/**
 * Formate, die für dieses Bild in Frage kommen – in Wunschreihenfolge.
 * WebP ist am kleinsten; ohne WebP tut es JPEG, bei Transparenz PNG.
 *
 * @return list<string>
 */
function ffk_image_target_formats(string $engine, bool $brauchtTransparenz): array
{
    $can = ffk_image_capabilities()[$engine];
    $wunsch = $brauchtTransparenz ? ['webp', 'png', 'jpeg'] : ['webp', 'jpeg', 'png'];
    return array_values(array_filter($wunsch, static fn (string $f) => $can[$f]));
}

/**
 * Prüft, ob der Arbeitsspeicher für ein Bild dieser Größe reicht.
 *
 * GD hält das entpackte Bild mit rund 4 Byte je Bildpunkt im Speicher, dazu
 * kommt das verkleinerte Ergebnis (höchstens 1600 px) und etwas Puffer für
 * den Dekoder. Die Schätzung ist bewusst knapp gehalten: Sie soll nur das
 * abfangen, was PHP sonst hart abstürzen ließe, und keine normalen
 * Handy-Fotos ablehnen.
 *
 * @throws FfkImageException wenn der Speicher nicht reicht
 */
function ffk_check_memory_for_image(int $breite, int $hoehe): void
{
    $limit = ffk_ini_bytes((string) ini_get('memory_limit'));
    if ($limit <= 0) {
        return; // unbegrenzt
    }
    $quelle = $breite * $hoehe * 4;
    $ziel = min($breite, FFK_IMAGE_MAX_EDGE) * min($hoehe, FFK_IMAGE_MAX_EDGE) * 4;
    $benoetigt = (int) ($quelle * 1.2 + $ziel + 4 * 1024 * 1024);
    $frei = $limit - memory_get_usage(true);
    if ($benoetigt <= $frei) {
        return;
    }
    $megapixel = round($breite * $hoehe / 1000000, 1);
    throw new FfkImageException(sprintf(
        'Das Bild ist mit %s Megapixeln zu groß für den eingestellten Arbeitsspeicher '
        . '(memory_limit = %s). Bitte memory_limit in den PHP-Einstellungen erhöhen '
        . '– oder das Foto vorher verkleinern.',
        str_replace('.', ',', (string) $megapixel),
        (string) ini_get('memory_limit')
    ));
}

/**
 * Optimiert ein Bild an Ort und Stelle.
 *
 * Probiert der Reihe nach jede vorhandene Bibliothek und jedes mögliche
 * Ausgabeformat. Erst wenn nichts davon funktioniert, wird abgebrochen – und
 * zwar mit den gesammelten Gründen, nicht mit einer Vermutung.
 *
 * @return string Neuer Dateipfad. Bei GIFs bleibt der Pfad unverändert.
 * @throws FfkImageException mit einer verständlichen deutschen Begründung
 */
function ffk_optimize_image(string $path, string $mimeType): string
{
    $info = @getimagesize($path);
    if ($info === false || empty($info[0]) || empty($info[1])) {
        throw new FfkImageException('Die Datei ist kein Bild oder beschädigt.');
    }

    // Animationen nicht zerstören
    if ($mimeType === 'image/gif' || $info[2] === IMAGETYPE_GIF) {
        return $path;
    }

    $can = ffk_image_capabilities();
    if ($can['engines'] === []) {
        throw new FfkImageException(
            'Auf dem Server fehlt die Bildbearbeitung. Bitte beim Hoster die PHP-Erweiterung '
            . '„gd" (oder „imagick") aktivieren lassen.'
        );
    }

    // PNG, WebP und AVIF können durchsichtige Bereiche enthalten
    $mitTransparenz = in_array($info[2], [IMAGETYPE_PNG, IMAGETYPE_WEBP, IMAGETYPE_AVIF], true);

    $gruende = [];
    foreach ($can['engines'] as $engine) {
        // GD entpackt das Bild vollständig in den Arbeitsspeicher. Reicht der
        // nicht, bricht PHP hart ab (nicht abfangbar) – deshalb vorher rechnen.
        if ($engine === 'gd') {
            try {
                ffk_check_memory_for_image((int) $info[0], (int) $info[1]);
            } catch (FfkImageException $e) {
                $gruende[] = 'gd: ' . $e->getMessage();
                continue;
            }
        }

        foreach (ffk_image_target_formats($engine, $mitTransparenz) as $format) {
            $endung = $format === 'jpeg' ? 'jpg' : $format;
            $tmp = $path . '.tmp.' . $endung;
            @unlink($tmp);
            try {
                if ($engine === 'imagick') {
                    ffk_optimize_with_imagick($path, $tmp, $format);
                } else {
                    ffk_optimize_with_gd($path, $tmp, (int) $info[2], $format);
                }
            } catch (Throwable $e) {
                @unlink($tmp);
                $gruende[] = "$engine/$format: " . $e->getMessage();
                continue;
            }
            if (!is_file($tmp) || filesize($tmp) === 0) {
                @unlink($tmp);
                $gruende[] = "$engine/$format: leere Datei geschrieben";
                continue;
            }

            $target = preg_replace('/\.[a-z0-9]+$/i', '', $path) . '.' . $endung;
            if ($target === $path) {
                $target .= '.' . $endung;
            }
            @unlink($path);
            if (!@rename($tmp, $target)) {
                @unlink($tmp);
                throw new FfkImageException(
                    'Das fertige Bild konnte nicht gespeichert werden – bitte die Schreibrechte '
                    . 'im Ordner uploads/ prüfen.'
                );
            }
            return $target;
        }
    }

    // Nichts hat funktioniert: die echten Gründe nennen, damit sie behebbar sind.
    error_log('[FFK] Bildumwandlung fehlgeschlagen – ' . implode(' | ', $gruende));
    throw new FfkImageException(
        'Das Bild konnte nicht umgewandelt werden. Technische Angaben zum Weitergeben: '
        . implode(' | ', array_slice($gruende, 0, 4))
        . ' [Server: ' . ffk_image_capabilities_text() . ']'
    );
}

/**
 * Wendet die EXIF-Drehung an.
 *
 * autoOrientImage() gibt es erst ab Imagick 3.3 / ImageMagick 6.9 – ältere
 * Fassungen sind bei Hostern durchaus verbreitet. Fehlt die Methode, wird die
 * Drehung von Hand ausgeführt.
 */
function ffk_imagick_auto_orient(Imagick $im): void
{
    if (method_exists($im, 'autoOrientImage')) {
        $im->autoOrientImage();
        $im->setImageOrientation(Imagick::ORIENTATION_TOPLEFT);
        return;
    }

    $hintergrund = new ImagickPixel('white');
    switch ($im->getImageOrientation()) {
        case Imagick::ORIENTATION_TOPRIGHT:
            $im->flopImage();
            break;
        case Imagick::ORIENTATION_BOTTOMRIGHT:
            $im->rotateImage($hintergrund, 180);
            break;
        case Imagick::ORIENTATION_BOTTOMLEFT:
            $im->flopImage();
            $im->rotateImage($hintergrund, 180);
            break;
        case Imagick::ORIENTATION_LEFTTOP:
            $im->flopImage();
            $im->rotateImage($hintergrund, -90);
            break;
        case Imagick::ORIENTATION_RIGHTTOP:
            $im->rotateImage($hintergrund, 90);
            break;
        case Imagick::ORIENTATION_RIGHTBOTTOM:
            $im->flopImage();
            $im->rotateImage($hintergrund, 90);
            break;
        case Imagick::ORIENTATION_LEFTBOTTOM:
            $im->rotateImage($hintergrund, -90);
            break;
        default:
            break; // bereits richtig herum oder unbekannt
    }
    $im->setImageOrientation(Imagick::ORIENTATION_TOPLEFT);
}

/**
 * Variante mit Imagick.
 *
 * @throws Throwable mit der Originalmeldung – manche Hoster schränken Imagick
 *                   per policy.xml ein; diese Meldung soll sichtbar bleiben.
 */
function ffk_optimize_with_imagick(string $src, string $dest, string $format): void
{
    $im = new Imagick($src);
    try {
        // EXIF-Drehung ins Bild übernehmen und Orientierungs-Flag zurücksetzen
        ffk_imagick_auto_orient($im);

        if ($im->getImageWidth() > FFK_IMAGE_MAX_EDGE || $im->getImageHeight() > FFK_IMAGE_MAX_EDGE) {
            // bestfit=true begrenzt beide Kanten, ohne das Seitenverhältnis zu ändern
            $im->resizeImage(FFK_IMAGE_MAX_EDGE, FFK_IMAGE_MAX_EDGE, Imagick::FILTER_LANCZOS, 1, true);
        }

        // Alle Metadaten entfernen (EXIF inkl. GPS, IPTC, XMP, Farbprofile)
        $im->stripImage();

        if ($format === 'jpeg') {
            // Transparenz würde im JPEG schwarz – deshalb auf Weiß legen
            $im->setImageBackgroundColor(new ImagickPixel('white'));
            $flach = $im->flattenImages();
            $im->clear();
            $im = $flach;
        }
        $im->setImageFormat($format);
        $im->setImageCompressionQuality(FFK_IMAGE_WEBP_QUALITY);
        if (!$im->writeImage($dest)) {
            throw new FfkImageException('writeImage lieferte false');
        }
    } finally {
        $im->clear();
    }
}

/**
 * Variante mit GD. GD schreibt grundsätzlich keine Metadaten mit.
 *
 * Hier und in den GD-Hilfsfunktionen steht bewusst kein imagedestroy(): Seit
 * PHP 8.0 sind GD-Bilder Objekte und geben sich selbst frei, seit PHP 8.5 ist
 * der Aufruf zusätzlich als veraltet gemeldet.
 *
 * @throws FfkImageException mit dem konkreten Grund
 */
function ffk_optimize_with_gd(string $src, string $dest, int $imageType, string $format): void
{
    $img = ffk_gd_load($src, $imageType);
    if ($img === null) {
        throw new FfkImageException('Bildtyp kann von GD nicht gelesen werden');
    }

    $img = ffk_gd_apply_exif_rotation($img, $src, $imageType);
    $img = ffk_gd_resize_within($img, FFK_IMAGE_MAX_EDGE);

    if ($format === 'jpeg') {
        $img = ffk_gd_flatten($img); // JPEG kennt keine Transparenz
        $ok = imagejpeg($img, $dest, FFK_IMAGE_WEBP_QUALITY);
    } else {
        imagealphablending($img, false);
        imagesavealpha($img, true);
        $ok = $format === 'png'
            ? imagepng($img, $dest, 6)
            : imagewebp($img, $dest, FFK_IMAGE_WEBP_QUALITY);
    }
    if (!$ok) {
        throw new FfkImageException('Schreiben der Bilddatei lieferte false');
    }
}

/** Lädt eine Bilddatei als GD-Bild. */
function ffk_gd_load(string $src, int $imageType): ?GdImage
{
    $img = match ($imageType) {
        IMAGETYPE_JPEG => function_exists('imagecreatefromjpeg') ? @imagecreatefromjpeg($src) : false,
        IMAGETYPE_PNG => function_exists('imagecreatefrompng') ? @imagecreatefrompng($src) : false,
        IMAGETYPE_WEBP => function_exists('imagecreatefromwebp') ? @imagecreatefromwebp($src) : false,
        IMAGETYPE_GIF => function_exists('imagecreatefromgif') ? @imagecreatefromgif($src) : false,
        IMAGETYPE_AVIF => function_exists('imagecreatefromavif') ? @imagecreatefromavif($src) : false,
        IMAGETYPE_BMP => function_exists('imagecreatefrombmp') ? @imagecreatefrombmp($src) : false,
        default => false,
    };
    return $img instanceof GdImage ? $img : null;
}

/**
 * Wendet die EXIF-Orientierung auf ein GD-Bild an (GD kennt EXIF nicht selbst).
 * Danach ist die Drehung fest im Bild und die Metadaten werden nicht übernommen.
 */
function ffk_gd_apply_exif_rotation(GdImage $img, string $src, int $imageType): GdImage
{
    if ($imageType !== IMAGETYPE_JPEG || !function_exists('exif_read_data')) {
        return $img;
    }
    $exif = @exif_read_data($src);
    $orientation = is_array($exif) ? (int) ($exif['Orientation'] ?? 0) : 0;
    if ($orientation < 2 || $orientation > 8) {
        return $img;
    }

    // Spiegelungen (2, 4, 5, 7) zuerst, danach die Drehung
    if (in_array($orientation, [2, 4, 5, 7], true)) {
        imageflip($img, IMG_FLIP_HORIZONTAL);
    }
    $angle = match ($orientation) {
        3, 4 => 180,
        5, 6 => -90,
        7, 8 => 90,
        default => 0,
    };
    if ($angle !== 0) {
        $rotated = imagerotate($img, $angle, 0);
        if ($rotated instanceof GdImage) {
            $img = $rotated;
        }
    }
    return $img;
}

/** Legt durchsichtige Bereiche auf Weiß – sonst werden sie im JPEG schwarz. */
function ffk_gd_flatten(GdImage $img): GdImage
{
    $w = imagesx($img);
    $h = imagesy($img);
    $flat = imagecreatetruecolor($w, $h);
    imagefilledrectangle($flat, 0, 0, $w, $h, imagecolorallocate($flat, 255, 255, 255));
    imagealphablending($flat, true);
    imagecopy($flat, $img, 0, 0, 0, 0, $w, $h);
    return $flat;
}

/** Verkleinert ein GD-Bild so, dass beide Kanten <= $maxEdge sind (nie vergrößern). */
function ffk_gd_resize_within(GdImage $img, int $maxEdge): GdImage
{
    $w = imagesx($img);
    $h = imagesy($img);
    if ($w <= $maxEdge && $h <= $maxEdge) {
        return $img;
    }
    $scale = min($maxEdge / $w, $maxEdge / $h);
    $newW = max(1, (int) round($w * $scale));
    $newH = max(1, (int) round($h * $scale));

    $dst = imagecreatetruecolor($newW, $newH);
    imagealphablending($dst, false);
    imagesavealpha($dst, true);
    $transparent = imagecolorallocatealpha($dst, 0, 0, 0, 127);
    imagefilledrectangle($dst, 0, 0, $newW, $newH, $transparent);
    imagecopyresampled($dst, $img, 0, 0, 0, 0, $newW, $newH, $w, $h);
    return $dst;
}

/**
 * Erzeugt ein Vorschaubild (JPEG) – wird von der Erstbefüllung für die
 * Titelbilder migrierter Beiträge genutzt (Parität zu makeThumb()).
 */
function ffk_make_thumb(string $src, string $dest, int $maxWidth = 1280, int $quality = 72): bool
{
    $info = @getimagesize($src);
    if ($info === false) {
        return false;
    }

    if (ffk_has_imagick()) {
        try {
            $im = new Imagick($src);
            ffk_imagick_auto_orient($im);
            if ($im->getImageWidth() > $maxWidth) {
                $im->resizeImage($maxWidth, 0, Imagick::FILTER_LANCZOS, 1);
            }
            $im->stripImage();
            // Transparenz auf Weiß legen, sonst wird sie im JPEG schwarz
            $im->setImageBackgroundColor(new ImagickPixel('white'));
            $im = $im->flattenImages();
            $im->setImageFormat('jpeg');
            $im->setImageCompressionQuality($quality);
            $im->writeImage($dest);
            $im->clear();
            $im->destroy();
            return true;
        } catch (Throwable $e) {
            error_log('[FFK] Vorschaubild (Imagick) fehlgeschlagen: ' . $e->getMessage());
            return false;
        }
    }

    if (!ffk_has_gd() || !function_exists('imagejpeg')) {
        return false;
    }
    $img = ffk_gd_load($src, $info[2]);
    if ($img === null) {
        return false;
    }
    try {
        $img = ffk_gd_apply_exif_rotation($img, $src, $info[2]);
        $w = imagesx($img);
        $h = imagesy($img);
        if ($w > $maxWidth) {
            $newW = $maxWidth;
            $newH = max(1, (int) round($h * ($maxWidth / $w)));
            $dst = imagecreatetruecolor($newW, $newH);
            imagefilledrectangle($dst, 0, 0, $newW, $newH, imagecolorallocate($dst, 255, 255, 255));
            imagecopyresampled($dst, $img, 0, 0, 0, 0, $newW, $newH, $w, $h);
            $img = $dst;
        } else {
            // Transparenz für JPEG auf Weiß legen
            $flat = imagecreatetruecolor($w, $h);
            imagefilledrectangle($flat, 0, 0, $w, $h, imagecolorallocate($flat, 255, 255, 255));
            imagecopy($flat, $img, 0, 0, 0, 0, $w, $h);
            $img = $flat;
        }
        return imagejpeg($img, $dest, $quality);
    } catch (Throwable $e) {
        error_log('[FFK] Vorschaubild (GD) fehlgeschlagen: ' . $e->getMessage());
        return false;
    }
}
