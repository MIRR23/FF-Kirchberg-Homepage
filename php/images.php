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

/**
 * Optimiert ein Bild an Ort und Stelle.
 *
 * @return string|null Neuer Dateipfad (i. d. R. .webp) oder null, wenn die
 *                     Datei kein verarbeitbares Bild ist. Bei GIFs bleibt der
 *                     Pfad unverändert.
 */
function ffk_optimize_image(string $path, string $mimeType): ?string
{
    $info = @getimagesize($path);
    if ($info === false || empty($info[0]) || empty($info[1])) {
        return null; // kein Bild
    }

    // Animationen nicht zerstören
    if ($mimeType === 'image/gif' || $info[2] === IMAGETYPE_GIF) {
        return $path;
    }

    $target = preg_replace('/\.[a-z0-9]+$/i', '', $path) . '.webp';
    if ($target === $path) {
        $target .= '.webp';
    }
    $tmp = $path . '.tmp.webp';

    $ok = ffk_has_imagick()
        ? ffk_optimize_with_imagick($path, $tmp)
        : (ffk_has_gd() ? ffk_optimize_with_gd($path, $tmp, $info[2]) : false);

    if (!$ok || !is_file($tmp) || filesize($tmp) === 0) {
        @unlink($tmp);
        return null;
    }

    @unlink($path);
    if (!@rename($tmp, $target)) {
        @unlink($tmp);
        return null;
    }
    return $target;
}

/** Variante mit Imagick. */
function ffk_optimize_with_imagick(string $src, string $dest): bool
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

        $im->setImageFormat('webp');
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
function ffk_optimize_with_gd(string $src, string $dest, int $imageType): bool
{
    if (!function_exists('imagewebp')) {
        return false; // GD ohne WebP-Unterstützung
    }
    $img = ffk_gd_load($src, $imageType);
    if ($img === null) {
        return false;
    }
    try {
        $img = ffk_gd_apply_exif_rotation($img, $src, $imageType);
        $img = ffk_gd_resize_within($img, FFK_IMAGE_MAX_EDGE);
        imagealphablending($img, false);
        imagesavealpha($img, true);
        return imagewebp($img, $dest, FFK_IMAGE_WEBP_QUALITY);
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
