/**
 * Zentrale Pfade für alle veränderlichen Daten (Datenbank + Uploads).
 *
 * Über die Umgebungsvariable DATA_DIR lassen sich diese Daten in ein eigenes
 * Verzeichnis legen (z. B. /app/data im Container), das als Volume gemountet
 * wird. So überleben Inhalte Image-Updates, ohne dass das Volume den
 * Anwendungscode überdeckt. Ohne DATA_DIR bleibt alles wie bisher im
 * Projektverzeichnis (Entwicklung).
 */
import path from "node:path";
import fs from "node:fs";

export const DATA_DIR = path.resolve(process.env.DATA_DIR || process.cwd());
export const UPLOADS_DIR = path.join(DATA_DIR, "uploads");
export const DB_FILE = path.join(DATA_DIR, "data.db");

fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// Mitgelieferte Uploads (migrierte Bilder, Hero-Grafik, Logos) ins
// Datenverzeichnis übernehmen. force:false kopiert nur Dateien, die dort noch
// fehlen – vorhandene (ggf. vom Redakteur ausgetauschte) Dateien bleiben
// unangetastet, neue Dateien aus App-Updates kommen trotzdem an.
const bundledUploads = path.resolve(process.cwd(), "uploads");
if (bundledUploads !== UPLOADS_DIR && fs.existsSync(bundledUploads)) {
  try {
    fs.cpSync(bundledUploads, UPLOADS_DIR, { recursive: true, force: false, errorOnExist: false });
  } catch (err) {
    console.error("Konnte mitgelieferte Uploads nicht ins Datenverzeichnis kopieren:", err);
  }
}
