/**
 * Fotos schon im Browser verkleinern, bevor sie hochgeladen werden.
 *
 * Handy-Fotos sind heute 5 bis 25 MB groß. Viele Webserver weisen so große
 * Anfragen ab, bevor PHP sie überhaupt zu sehen bekommt – der Upload bricht
 * dann mit einer nichtssagenden Meldung ab, weil die Antwort keine Meldung
 * der Anwendung mehr ist. Außerdem dauert das Hochladen über Mobilfunk
 * unnötig lange.
 *
 * Der Server verkleinert ohnehin auf 1600 px, deshalb geht dabei nichts
 * verloren. Nebenbei löst das die iPhone-Fotos im Format HEIC: Safari kann
 * sie anzeigen und damit auch umwandeln, PHP kann sie nicht lesen.
 *
 * Klappt das Verkleinern nicht (altes Gerät, unbekanntes Format), wird die
 * Originaldatei geschickt – dann versucht es der Server wie bisher selbst.
 */

/** Längste Kante nach dem Verkleinern – wie auf dem Server. */
const MAX_EDGE = 1600;

/** Darunter lohnt sich das Verkleinern nicht. */
const SHRINK_ABOVE_BYTES = 1024 * 1024;

/** iPhone-Format, das PHP nicht lesen kann – immer umwandeln. */
function isHeic(file: File): boolean {
  return /hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name);
}

/** Dateiendung passend zum tatsächlich erzeugten Typ. */
function extensionFor(mimeType: string): string {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return "jpg";
}

/**
 * Lädt die Datei als zeichenbare Bildquelle.
 *
 * `createImageBitmap` ist der direkte Weg, kann aber je nach Browser und
 * Format streiken. Dann tut es ein normales `<img>`: Browser drehen dabei
 * seit Jahren selbst nach der EXIF-Angabe, das Foto steht also richtig.
 */
async function decode(file: File): Promise<{
  source: CanvasImageSource;
  width: number;
  height: number;
  release: () => void;
}> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        release: () => bitmap.close(),
      };
    } catch {
      // Safari mag manche Formate nur über <img> – unten weiter
    }
  }

  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise<void>((fertig, fehler) => {
      img.onload = () => fertig();
      img.onerror = () => fehler(new Error("Bild nicht lesbar"));
      img.src = url;
    });
    return {
      source: img,
      width: img.naturalWidth,
      height: img.naturalHeight,
      release: () => URL.revokeObjectURL(url),
    };
  } catch (err) {
    URL.revokeObjectURL(url);
    throw err;
  }
}

/**
 * Gibt die Datei verkleinert zurück – oder unverändert, wenn das nicht nötig
 * ist oder nicht funktioniert hat.
 */
export async function shrinkForUpload(file: File): Promise<File> {
  // Animierte GIFs verlören beim Umwandeln ihre Animation
  if (file.type === "image/gif") return file;
  if (!file.type.startsWith("image/") && !isHeic(file)) return file;
  if (file.size <= SHRINK_ABOVE_BYTES && !isHeic(file)) return file;

  try {
    const bild = await decode(file);
    try {
      if (!bild.width || !bild.height) return file;
      const faktor = Math.min(1, MAX_EDGE / Math.max(bild.width, bild.height));
      const breite = Math.max(1, Math.round(bild.width * faktor));
      const hoehe = Math.max(1, Math.round(bild.height * faktor));

      const canvas = document.createElement("canvas");
      canvas.width = breite;
      canvas.height = hoehe;
      const ctx = canvas.getContext("2d");
      if (!ctx) return file;
      ctx.drawImage(bild.source, 0, 0, breite, hoehe);

      // PNG und WebP behalten ihr Format, sonst gingen durchsichtige
      // Bereiche verloren (z. B. bei einem Logo mit freigestelltem Rand).
      const wunschTyp = file.type === "image/png" || file.type === "image/webp" ? file.type : "image/jpeg";
      const blob = await new Promise<Blob | null>((fertig) => canvas.toBlob(fertig, wunschTyp, 0.9));
      if (!blob) return file;
      // Nur übernehmen, wenn es wirklich kleiner wurde. HEIC muss immer
      // umgewandelt werden, auch wenn die Datei dabei größer wird.
      if (blob.size >= file.size && !isHeic(file)) return file;

      const name = file.name.replace(/\.[^.]+$/, "") + "." + extensionFor(blob.type);
      return new File([blob], name, { type: blob.type, lastModified: file.lastModified });
    } finally {
      bild.release();
    }
  } catch {
    return file; // lieber im Original hochladen als gar nicht
  }
}

/** Verkleinert mehrere Dateien nacheinander (schont den Speicher am Handy). */
export async function shrinkAllForUpload(files: FileList | File[]): Promise<File[]> {
  const out: File[] = [];
  for (const file of Array.from(files)) {
    out.push(await shrinkForUpload(file));
  }
  return out;
}
