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
 * verloren. Nebenbei löst das die iPhone-Fotos im Format HEIC, die PHP nicht
 * lesen kann: Safari kann sie öffnen und wandelt sie dabei um. Chrome am
 * iPhone kann das nicht – dort bricht der Upload sofort mit einer Meldung ab,
 * die sagt, was zu tun ist, statt erst Minuten lang Daten zu schicken.
 *
 * Klappt das Verkleinern aus einem anderen Grund nicht (altes Gerät,
 * unbekanntes Format), wird die Originaldatei geschickt – dann versucht es
 * der Server wie bisher selbst.
 */

/** Längste Kante nach dem Verkleinern – wie auf dem Server. */
const MAX_EDGE = 1600;

/** Darunter lohnt sich das Verkleinern nicht. */
const SHRINK_ABOVE_BYTES = 1024 * 1024;

/**
 * iPhone-Format, das PHP nicht lesen kann – immer umwandeln.
 *
 * Auf Name und Typ ist kein Verlass: Safari wandelt Fotos beim Auswählen
 * selbst in JPG um, Chrome am iPhone reicht die HEIC-Datei durch und nennt
 * sie trotzdem oft „image.jpg". Deshalb wird zusätzlich in die Datei
 * geschaut – HEIC ist ein ISO-Container mit „ftyp" ab Byte 4.
 */
async function isHeic(file: File): Promise<boolean> {
  if (/hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name)) return true;
  try {
    const kopf = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    if (kopf.length < 12) return false;
    const text = (von: number, bis: number) => String.fromCharCode(...Array.from(kopf.slice(von, bis)));
    if (text(4, 8) !== "ftyp") return false;
    return ["heic", "heix", "heim", "heis", "hevc", "hevx", "hevm", "hevs", "mif1", "msf1"]
      .includes(text(8, 12));
  } catch {
    return false;
  }
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

/** Meldung für ein HEIC-Foto, das dieser Browser nicht umwandeln kann. */
function heicHinweis(file: File): Error {
  return new Error(
    `„${file.name}“ ist ein iPhone-Foto im Format HEIC, das dieser Browser nicht umwandeln `
    + "kann und der Server nicht lesen kann. Zwei Wege: am iPhone unter Einstellungen → Kamera → "
    + "Formate „Maximale Kompatibilität“ einstellen (dann entstehen JPG-Fotos), oder die Seite "
    + "zum Hochladen mit Safari öffnen.",
  );
}

/**
 * Gibt die Datei verkleinert zurück – oder unverändert, wenn das nicht nötig
 * ist oder nicht funktioniert hat.
 *
 * Nur bei HEIC wird abgebrochen statt weitergemacht: Diese Dateien kann der
 * Server ohnehin nicht lesen, ein Hochladen wäre vergebliche Wartezeit.
 */
export async function shrinkForUpload(file: File): Promise<File> {
  // Animierte GIFs verlören beim Umwandeln ihre Animation
  if (file.type === "image/gif") return file;

  const heic = await isHeic(file);
  if (!file.type.startsWith("image/") && !heic) return file;
  if (file.size <= SHRINK_ABOVE_BYTES && !heic) return file;

  try {
    // Chrome am iPhone reicht HEIC-Dateien als „image/jpeg" durch. Mit dem
    // richtigen Typ findet der Browser eher den passenden Dekoder.
    const quelle = heic && !/hei[cf]/i.test(file.type)
      ? new File([file], file.name, { type: "image/heic" })
      : file;

    const bild = await decode(quelle);
    try {
      if (!bild.width || !bild.height) throw new Error("Bild ohne Abmessungen");
      const faktor = Math.min(1, MAX_EDGE / Math.max(bild.width, bild.height));
      const breite = Math.max(1, Math.round(bild.width * faktor));
      const hoehe = Math.max(1, Math.round(bild.height * faktor));

      const canvas = document.createElement("canvas");
      canvas.width = breite;
      canvas.height = hoehe;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Zeichenfläche nicht verfügbar");
      ctx.drawImage(bild.source, 0, 0, breite, hoehe);

      // PNG und WebP behalten ihr Format, sonst gingen durchsichtige
      // Bereiche verloren (z. B. bei einem Logo mit freigestelltem Rand).
      const wunschTyp = file.type === "image/png" || file.type === "image/webp" ? file.type : "image/jpeg";
      const blob = await new Promise<Blob | null>((fertig) => canvas.toBlob(fertig, wunschTyp, 0.9));
      if (!blob) throw new Error("Umwandeln lieferte kein Ergebnis");
      // Nur übernehmen, wenn es wirklich kleiner wurde. HEIC muss immer
      // umgewandelt werden, auch wenn die Datei dabei größer wird.
      if (blob.size >= file.size && !heic) return file;

      const name = file.name.replace(/\.[^.]+$/, "") + "." + extensionFor(blob.type);
      return new File([blob], name, { type: blob.type, lastModified: file.lastModified });
    } finally {
      bild.release();
    }
  } catch {
    if (heic) throw heicHinweis(file);
    return file; // sonst lieber im Original hochladen als gar nicht
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
