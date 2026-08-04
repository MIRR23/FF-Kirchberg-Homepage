/**
 * Baut das Upload-fertige Paket für den Webserver.
 *
 *   node script/build-deploy.mjs           → dist/deploy/ + beide ZIP-Dateien
 *   node script/build-deploy.mjs --no-zip  → nur dist/deploy/ (zum lokalen Testen)
 *
 * Ergebnis in dist/:
 *   deploy/                      Ordner mit genau dem Inhalt für den Web-Ordner
 *   ffk-homepage-komplett.zip    Erstinstallation (inkl. Bilder & Migrationsdaten)
 *   ffk-homepage-update.zip      Update (nur Programmdateien, ohne uploads/)
 */
import { build as viteBuild } from "vite";
import { cp, mkdir, rm, readdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(import.meta.dirname, "..");
const DIST = path.join(ROOT, "dist");
const DEPLOY = path.join(DIST, "deploy");

/** Programmdateien: bei jedem Update auszutauschen. */
const APP_FILES = ["api.php", "datei.php", "config.example.php"];
const APP_DIRS = ["php"];
/** Daten für die Erstbefüllung: nur bei der Erstinstallation nötig. */
const DATA_DIRS = ["uploads", "migration-data"];

async function main() {
  const withZip = !process.argv.includes("--no-zip");

  await rm(DEPLOY, { recursive: true, force: true });
  await mkdir(DEPLOY, { recursive: true });

  console.log("Frontend bauen …");
  await viteBuild();

  console.log("Paket zusammenstellen …");
  // 1. Statisches Frontend (index.html + assets/) in die Wurzel
  await cp(path.join(DIST, "public"), DEPLOY, { recursive: true });

  // 2. PHP-Backend
  for (const file of APP_FILES) {
    await cp(path.join(ROOT, file), path.join(DEPLOY, file));
  }
  for (const dir of APP_DIRS) {
    await cp(path.join(ROOT, dir), path.join(DEPLOY, dir), { recursive: true });
  }

  // 3. Bilder und Migrationsdaten für die automatische Erstbefüllung
  for (const dir of DATA_DIRS) {
    if (existsSync(path.join(ROOT, dir))) {
      await cp(path.join(ROOT, dir), path.join(DEPLOY, dir), { recursive: true });
    }
  }

  // 4. Kurzanleitung direkt ins Paket legen
  await writeFile(path.join(DEPLOY, "LIESMICH.txt"), LIESMICH, "utf8");

  const entries = await readdir(DEPLOY);
  console.log(`Fertig: dist/deploy (${entries.length} Einträge: ${entries.sort().join(", ")})`);

  if (!withZip) return;

  console.log("ZIP-Dateien packen …");
  await zip("ffk-homepage-komplett.zip", ["."]);
  await zip(
    "ffk-homepage-update.zip",
    ["index.html", "assets", "LIESMICH.txt", ...APP_FILES, ...APP_DIRS].filter((e) =>
      existsSync(path.join(DEPLOY, e)),
    ),
  );
  console.log("Fertig: dist/ffk-homepage-komplett.zip, dist/ffk-homepage-update.zip");
}

/** Packt Einträge aus dist/deploy in eine ZIP-Datei in dist/. */
async function zip(name, entries) {
  const target = path.join(DIST, name);
  await rm(target, { force: true });
  // -r rekursiv, -q leise, -X ohne Betriebssystem-Zusatzinfos
  await execFileAsync("zip", ["-r", "-q", "-X", target, ...entries], { cwd: DEPLOY });
}

const LIESMICH = `FF Kirchberg – Website
======================

Diese Dateien gehören in den Web-Ordner des Servers (z. B. /html oder
/httpdocs). Vollständige Anleitung: BETRIEB.md im Git-Repository.

Kurzfassung der Erstinstallation
--------------------------------
1. Im Kundenpanel des Hosters eine MariaDB-/MySQL-Datenbank anlegen und
   Datenbankname, Benutzer und Passwort notieren.
2. Die Datei config.example.php in config.php umbenennen und die vier
   Zugangsdaten dort eintragen.
3. Alle Dateien dieses Pakets per SFTP in den Web-Ordner laden.
4. Die Website im Browser aufrufen. Beim ersten Aufruf legt sie die
   Datenbanktabellen selbst an und übernimmt alle Inhalte.
5. Unter /#/intern anmelden und die Passwörter ändern.

Update auf eine neue Version
----------------------------
Nur das Paket "ffk-homepage-update.zip" entpacken und hochladen. Es enthält
keine Bilder und keine config.php – vorhandene Inhalte bleiben unberührt.

Wichtig
-------
- config.php niemals überschreiben oder löschen.
- Der Ordner uploads/ enthält alle Bilder und Dokumente und muss
  beschreibbar sein (Rechte 755 bzw. 775).
`;

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
