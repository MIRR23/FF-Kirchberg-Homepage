# FF Kirchberg – Neue Homepage: Betriebs- und Übergabedokumentation

## Überblick

Moderne, responsive Website mit integriertem Verwaltungsbereich („Interner Bereich").

- **Frontend:** React + Vite + Tailwind CSS (dunkles Design, Rot/Amber-Akzente)
- **Backend:** Node.js + Express
- **Datenbank:** SQLite (Vorschau) – für den Zielserver auf MariaDB umstellbar (siehe unten)
- **Bilder:** Dateisystem unter `uploads/` (Originale + automatisch erzeugte Vorschaubilder)

## Zugangsdaten (bitte nach dem ersten Login ändern!)

| Benutzer    | Passwort              | Rolle                                                  |
| ----------- | --------------------- | ------------------------------------------------------ |
| `admin`     | `FFK-Admin-2026!`     | Administrator (alle Rechte, Benutzerverwaltung)        |
| `redakteur` | `FFK-Redakteur-2026!` | Beispiel-Redakteur (Einsätze, Neuigkeiten, Termine)    |

Login: Link „Interner Bereich" im Footer oder direkt `/#/intern`.
Passwort ändern: im internen Bereich unter „Passwort ändern".

## Berechtigungssystem

Der Administrator kann unter **Benutzer & Rechte** Benutzer anlegen und je Bereich Rechte vergeben:

- **Einsätze** – Einsatzberichte (Kategorien „Einsätze", „First Responder")
- **Neuigkeiten & Berichte** – alle übrigen Beiträge
- **Termine** – Veranstaltungen und Übungen
- **Fahrzeuge** – Gerätehaus-Seite
- **Mitglieder** – Vorstandschaft und Aktive
- **Seiten & Texte** – feste Seiten (Über uns, Chronik, Impressum, …)
- **Bilder löschen** – Löschen in der Mediathek (Hochladen darf jeder angemeldete Benutzer)
- **Dateien / Downloads** – Dateien mit dauerhaftem Link hochladen, austauschen und löschen
  (die Liste samt Link-Kopieren sieht jeder angemeldete Benutzer)

Sicherheitsnetz: Der letzte aktive Administrator kann nicht gelöscht oder deaktiviert werden.

## Inhalte pflegen

- **Startseite (Hero):** Unter „Startseite" werden das große Bild oben, Überschrift,
  Einleitungstext und Alternativtext gepflegt (Berechtigung „Seiten & Texte").
  Bildquelle wahlweise **Eigenes Bild** (Standard: Grafik mit Wappen + First-Responder-Logo,
  `uploads/hero-standard.png`) oder **Automatisch** (Titelbild des neuesten Einsatzberichts).
  Zusätzlich einstellbar: Darstellung (füllend für Fotos / eingepasst für Logos) und
  Stärke der Abdunkelung. Ein Wort der Überschrift zwischen zwei Sternchen (`*Minute*`)
  wird rot hervorgehoben. „Standard wiederherstellen" setzt alle Werte zurück.
  Die Standardgrafik lässt sich mit `npx tsx script/make-hero.ts` neu erzeugen.
- **Beiträge & Einsätze:** Titel, Kategorie, Einsatzstichwort/-ort, Datum, Titelbild, Text mit
  Bild-Upload direkt im Editor. Entwürfe möglich. Beiträge erscheinen automatisch auf
  Startseite, in „Aktuelles", „Einsätze" und im Jahres-Archiv.
- **Termine:** Datum, Uhrzeit, Ort, Art (Übung/Veranstaltung).
- **Fahrzeuge:** Name, Typ, Bild, Beschreibung, Sortierung.
- **Mitglieder:** Name, Funktion, Gruppe (Vorstandschaft/Aktive), optionales Foto.
  Aktuell sind nur Beispieleinträge gepflegt („Max Mustermann" usw.).
- **Seiten & Texte:** Über uns, Chronik, Historische Brände, Impressum, Datenschutz, Links.
- **Dateien (Downloads):** Unter „Dateien" können PDF-, Word-, Excel- oder
  PowerPoint-Dateien (u. a., max. 25 MB) hochgeladen werden – z. B. das Organigramm oder
  die Übungstermin-Übersicht. Jede Datei bekommt einen **dauerhaften Link**
  (`/dateien/<kürzel>`), der z. B. über das Link-Symbol im Texteditor in Beiträge oder
  Seiten eingefügt werden kann. Wird die Datei später über „Austauschen" ersetzt,
  bleibt der Link unverändert gültig – es muss nichts neu verlinkt werden.

### Automatische Bild-Optimierung

Alle hochgeladenen Bilder (Mediathek, Titelbilder, Fotos im Editor – auch große
Handy-Fotos bis 30 MB) werden beim Upload automatisch fürs Web aufbereitet:

- Verkleinerung auf maximal 1600 px Kantenlänge
- Neukodierung als platzsparendes WebP (aus ~10 MB Handy-Foto wird typischerweise < 1 MB)
- Übernahme der EXIF-Drehung (Hochformat-Fotos stehen richtig)
- Entfernung aller Metadaten – **inklusive GPS-Standort** vom Handy (Datenschutz)

Redakteure müssen also nichts beachten und können Fotos direkt vom Handy hochladen.
Nur animierte GIFs bleiben unverändert.

## Migrierte Inhalte

Von der alten Website (ff-kirchberg.de, WordPress) wurden vollständig übernommen:

- 187 Beiträge inkl. Bilder und Kategorien (Einsätze, First Responder, Veranstaltungen, Pressemeldungen, Allgemein)
- 456 Mediendateien (inkl. Satzung und Beitrittserklärung als PDF)
- Über uns, Chronik, Historische Brände, Impressum, Datenschutz, Links
- Fahrzeuge LF 10/6, TSF 8, MZF inkl. Beschreibungen und Fotos

## Vorschau veröffentlichen (Render.com, kostenlos)

Damit sich der Kunde die neue Seite ansehen kann, **ohne** dass vorher die alte Domain
umgestellt wird, lässt sich die App mit wenigen Klicks als Vorschau ins Netz stellen.
Die nötige Konfiguration (`render.yaml`) liegt im Repository.

1. Auf <https://render.com> mit dem GitHub-Konto anmelden (kostenlos).
2. **New → Blueprint** wählen und dieses Repository auswählen.
3. Render liest `render.yaml`, baut die App und startet sie automatisch.
4. Nach wenigen Minuten ist die Seite unter einer öffentlichen Adresse erreichbar,
   z. B. `https://ff-kirchberg-vorschau.onrender.com` – dieser Link kann dem Kunden
   geschickt werden. Der interne Bereich ist unter `…/#/intern` erreichbar
   (Zugangsdaten siehe oben).

**Wichtig im kostenlosen Plan:**

- Der Speicher ist **nicht dauerhaft**: Bei einem neuen Deploy oder nach längerer
  Inaktivität wird er zurückgesetzt. Die Inhalte werden dann beim Start automatisch
  neu aus `migration-data/` erzeugt (Steuerung über die Variable `AUTO_MIGRATE`).
  Während der Vorschau im Backend angelegte Inhalte/Bilder gehen dabei verloren –
  für eine reine Ansichts-Vorschau ist das unkritisch.
- Der Dienst „schläft“ nach ~15 Minuten ohne Zugriff ein; der erste Aufruf danach
  dauert einige Sekunden länger (Kaltstart inkl. Neu-Migration).

Für **Dauerbetrieb mit erhaltenen Inhalten**: in `render.yaml` den `disk`-Abschnitt
aktivieren (kostenpflichtiger Plan) und `AUTO_MIGRATE` auf `0` setzen, oder auf den
eigenen Server umziehen (siehe unten).

### Alternative: Selbst-Hosten mit Docker

```bash
docker compose up -d --build      # Seite danach unter http://localhost:5000
```

Datenbank und Bilder bleiben im Volume `ffk-data` erhalten. Details siehe `Dockerfile`
und `docker-compose.yml`.

## Betrieb auf dem Zielserver (Node.js)

```bash
npm install
npm run build
NODE_ENV=production PORT=5000 node dist/index.cjs
```

Hinter einen Reverse-Proxy (nginx/Apache) mit HTTPS legen. Die Verzeichnisse `uploads/`
und die Datenbank regelmäßig sichern.

## Umstieg auf MariaDB

Aktuell nutzt die Anwendung SQLite (Datei `data.db`) – für den Start völlig ausreichend
und wartungsfrei. Für MariaDB:

1. `npm install mysql2`
2. In `shared/schema.ts` die Tabellen von `sqlite-core` auf `drizzle-orm/mysql-core` umstellen
   (`sqliteTable` → `mysqlTable`, `integer` → `int`, `text` → `varchar`/`text`).
3. In `server/storage.ts` den Treiber tauschen:
   `drizzle-orm/better-sqlite3` → `drizzle-orm/mysql2` mit Verbindungsdaten aus Umgebungsvariablen.
4. Die synchronen Aufrufe (`.get()/.all()/.run()`) auf `await` umstellen.
5. Migration erneut ausführen: `npx tsx server/migrate.ts`

Da alle Datenbankzugriffe zentral in `server/storage.ts` liegen, ist der Umstieg auf
wenige Dateien begrenzt.

## Wichtige Hinweise

- **Sitzungen:** Die Anmeldung bleibt im Browser gespeichert und überlebt auch ein
  Neuladen der Seite. Sie läuft nach 30 Tagen automatisch ab, danach ist eine erneute
  Anmeldung nötig. „Abmelden" beendet die Sitzung sofort.
- **Aktive/Vorstandschaft:** Nur Beispieldaten – echte Namen bitte im internen Bereich pflegen.
- **Termine:** Beispieltermine eingetragen – bitte anpassen.
- **Impressum/Datenschutz:** Inhalte wurden 1:1 von der alten Seite übernommen – bitte auf
  Aktualität prüfen (insbesondere Anschrift/Verantwortliche).
