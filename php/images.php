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
 * Was kann dieser Server? Wird für die Formatwahl und für verständliche
 * Fehlermeldungen gebraucht.
 *
 * @return array{engine:string,webp:bool,jpeg:bool,png:bool}
 */
function ffk_image_capabilities(): array
{
    static $cache = null;
    if ($cache !== null) {
        return $cache;
    }

    if (ffk_has_imagick()) {
        $formate = [];
        try {
            $formate = array_map('strtoupper', Imagick::queryFormats());
        } catch (Throwable) {
            $formate = [];
        }
        $cache = [
            'engine' => 'imagick',
            'webp' => in_array('WEBP', $formate, true),
            'jpeg' => in_array('JPEG', $formate, true),
            'png' => in_array('PNG', $formate, true),
        ];
        return $cache;
    }

    if (ffk_has_gd()) {
        $info = function_exists('gd_info') ? gd_info() : [];
        $cache = [
            'engine' => 'gd',
            'webp' => function_exists('imagewebp') && !empty($info['WebP Support']),
            'jpeg' => function_exists('imagejpeg') && !empty($info['JPEG Support']),
            'png' => function_exists('imagepng') && !empty($info['PNG Support']),
        ];
        return $cache;
    }

    $cache = ['engine' => 'keine', 'webp' => false, 'jpeg' => false, 'png' => false];
    return $cache;
}

/**
 * Wählt das Ausgabeformat: bevorzugt WebP (deutlich kleiner). Kann der Server
 * kein WebP – bei manchen Hostern ist GD ohne WebP übersetzt –, wird JPEG
 * bzw. bei Transparenz PNG genutzt. Ein fehlendes WebP darf nie dazu führen,
 * dass sich überhaupt keine Fotos hochladen lassen.
 */
function ffk_image_target_format(bool $brauchtTransparenz): string
{
    $can = ffk_image_capabilities();
    if ($can['webp']) {
        return 'webp';
    }
    if ($brauchtTransparenz && $can['png']) {
        return 'png';
    }
    if ($can['jpeg']) {
        return 'jpeg';
    }
    if ($can['png']) {
        return 'png';
    }
    throw new FfkImageException(
        'Der Server kann keine Bilder umwandeln. Bitte beim Hoster die PHP-Erweiterung '
        . '„gd" (oder „imagick") mit JPEG-Unterstützung aktivieren lassen.'
    );
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
        . '(memory_limit = %s). Bitte memory_limit in den PHP-Einstellungen auf mindestens '
        . '256M erhöhen – oder das Foto vorher verkleinern.',
        str_replace('.', ',', (string) $megapixel),
        (string) ini_get('memory_limit')
    ));
}

/**
 * Optimiert ein Bild an Ort und Stelle.
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
    if ($can['engine'] === 'keine') {
        throw new FfkImageException(
            'Auf dem Server fehlt die Bildbearbeitung. Bitte beim Hoster die PHP-Erweiterung '
            . '„gd" (oder „imagick") aktivieren lassen.'
        );
    }

    // GD entpackt das Bild vollständig in den Arbeitsspeicher. Reicht der nicht,
    // bricht PHP hart ab (nicht abfangbar) und der Redakteur sieht nur einen
    // Serverfehler. Deshalb vorher rechnen und verständlich melden.
    if ($can['engine'] === 'gd') {
        ffk_check_memory_for_image((int) $info[0], (int) $info[1]);
    }

    // PNG, WebP und AVIF können durchsichtige Bereiche enthalten
    $mitTransparenz = in_array($info[2], [IMAGETYPE_PNG, IMAGETYPE_WEBP, IMAGETYPE_AVIF], true);
    $format = ffk_image_target_format($mitTransparenz);
    $endung = $format === 'jpeg' ? 'jpg' : $format;

    $target = preg_replace('/\.[a-z0-9]+$/i', '', $path) . '.' . $endung;
    if ($target === $path) {
        $target .= '.' . $endung;
    }
    $tmp = $path . '.tmp.' . $endung;

    $ok = $can['engine'] === 'imagick'
        ? ffk_optimize_with_imagick($path, $tmp, $format)
        : ffk_optimize_with_gd($path, $tmp, $info[2], $format);

    if (!$ok || !is_file($tmp) || filesize($tmp) === 0) {
        @unlink($tmp);
        throw new FfkImageException(
            'Das Bild konnte nicht umgewandelt werden. Häufigste Ursache: zu wenig Arbeitsspeicher '
            . '(memory_limit) für ein sehr großes Foto.'
        );
    }

    @unlink($path);
    if (!@rename($tmp, $target)) {
        @unlink($tmp);
        throw new FfkImageException('Das fertige Bild konnte nicht gespeichert werden (Schreibrechte im Ordner uploads/ prüfen).');
    }
    return $target;
}

/** Variante mit Imagick. */
function ffk_optimize_with_imagick(string $src, string $dest, string $format = 'webp'): bool
{
    try {
        $im = new Imagick($src);
        // EXIF-Drehung ins Bild übernehmen und Orientierungs-Flag zurücksetzen
        $im->autoOrientImage();
        $im->setImageOrientation(Imagick::ORIENTATION_TOPLEFT);

        $w = $im->getImageWidth();
        $h = $im->getImageHeight();
        if ($w > FFK_IMAGE_MAX_EDGE || $h > FFK_IMAGE_MAX_EDGE) {
            // bestfit=true begrenzt beide Kanten, ohne das Seitenverhältnis zu ändern
            $im->resizeImage(FFK_IMAGE_MAX_EDGE, FFK_IMAGE_MAX_EDGE, Imagick::FILTER_LANCZOS, 1, true);
        }

        // Alle Metadaten entfernen (EXIF inkl. GPS, IPTC, XMP, Farbprofile)
        $im->stripImage();

        if ($format === 'jpeg') {
            // Transparenz würde im JPEG schwarz – deshalb auf Weiß legen
            $im->setImageBackgroundColor(new ImagickPixel('white'));
            $im = $im->flattenImages();
        }
        $im->setImageFormat($format);
        $im->setImageCompressionQuality(FFK_IMAGE_WEBP_QUALITY);
        $im->writeImage($dest);
        $im->clear();
        $im->destroy();
        return true;
    } catch (Throwable $e) {
        error_log('[FFK] Imagick-Verarbeitung fehlgeschlagen: ' . $e->getMessage());
        return false;
    }
}

/** Variante mit GD (Fallback). GD schreibt grundsätzlich keine Metadaten mit. */
function ffk_optimize_with_gd(string $src, string $dest, int $imageType, string $format = 'webp'): bool
{
    $img = ffk_gd_load($src, $imageType);
    if ($img === null) {
        return false;
    }
    try {
        $img = ffk_gd_apply_exif_rotation($img, $src, $imageType);
        $img = ffk_gd_resize_within($img, FFK_IMAGE_MAX_EDGE);
        if ($format === 'jpeg') {
            $img = ffk_gd_flatten($img); // JPEG kennt keine Transparenz
            return imagejpeg($img, $dest, FFK_IMAGE_WEBP_QUALITY);
        }
        imagealphablending($img, false);
        imagesavealpha($img, true);
        return $format === 'png'
            ? imagepng($img, $dest, 6)
            : imagewebp($img, $dest, FFK_IMAGE_WEBP_QUALITY);
    } catch (Throwable $e) {
        error_log('[FFK] GD-Verarbeitung fehlgeschlagen: ' . $e->getMessage());
        return false;
    } finally {
        if ($img instanceof GdImage) {
            imagedestroy($img);
        }
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
            imagedestroy($img);
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
    imagedestroy($img);
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
    imagedestroy($img);
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
            $im->autoOrientImage();
            $im->setImageOrientation(Imagick::ORIENTATION_TOPLEFT);
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
            imagedestroy($img);
            $img = $dst;
        } else {
            // Transparenz für JPEG auf Weiß legen
            $flat = imagecreatetruecolor($w, $h);
            imagefilledrectangle($flat, 0, 0, $w, $h, imagecolorallocate($flat, 255, 255, 255));
            imagecopy($flat, $img, 0, 0, 0, 0, $w, $h);
            imagedestroy($img);
            $img = $flat;
        }
        return imagejpeg($img, $dest, $quality);
    } catch (Throwable $e) {
        error_log('[FFK] Vorschaubild (GD) fehlgeschlagen: ' . $e->getMessage());
        return false;
    } finally {
        if ($img instanceof GdImage) {
            imagedestroy($img);
        }
    }
}
