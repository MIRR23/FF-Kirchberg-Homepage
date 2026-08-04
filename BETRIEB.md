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
  Bildquelle wahlweise **Automatisch** (Standard: Titelbild des neuesten Einsatzberichts
  mit Bild; ohne Beitragsbild erscheint das Ersatzbild) oder **Eigenes Bild**
  (z. B. die Grafik mit Wappen + First-Responder-Logo, `uploads/hero-standard.png`).
  Zusätzlich einstellbar: Darstellung (füllend für Fotos / eingepasst für Logos) und
  Stärke der Abdunkelung. Ein Wort der Überschrift zwischen zwei Sternchen (`*Minute*`)
  wird rot hervorgehoben. „Standard wiederherstellen" setzt alle Werte zurück.
  Die Standardgrafik lässt sich mit `npx tsx script/make-hero.ts` neu erzeugen;
  das Skript erzeugt dabei auch das freigestellte First-Responder-Logo
  (`uploads/first-responder-logo.png`), das fest oben auf der Seite
  „First Responder" angezeigt wird.
- **Beiträge & Einsätze:** Titel, Kategorie, Einsatzstichwort/-ort, Datum, Titelbild, Text mit
  Bild-Upload direkt im Editor. Entwürfe möglich. Beiträge erscheinen automatisch auf
  Startseite, in „Aktuelles", „Einsätze" und im Jahres-Archiv.
- **Termine:** Datum, Uhrzeit, Ort, Art (Übung/Veranstaltung).
- **Standort mit Karte (optional):** Beiträge/Einsätze und Termine können einen
  Kartenstandort bekommen – per Adresssuche oder direkt per Klick auf die Karte
  (praktisch für Einsätze abseits von Adressen, z. B. an einer Wegkreuzung).
  Besucher sehen dann beim Eintrag eine OpenStreetMap-Karte, die aus
  Datenschutzgründen erst nach Klick auf „Karte anzeigen" geladen wird
  (2-Klick-Lösung), plus einen Link „In Google Maps öffnen" zur Navigation.
  Die Datenschutzerklärung enthält den passenden Abschnitt dazu.
- **Fahrzeuge:** Name, Typ, Bild, Beschreibung, Sortierung.
- **Mitglieder:** Name, Funktion, Gruppe (Vorstandschaft/Aktive), optionales Foto.
  Aktuell sind nur Beispieleinträge gepflegt („Max Mustermann" usw.).
- **Seiten & Texte:** Über uns, Chronik, Historische Brände, First Responder,
  Impressum, Datenschutz, Links. Dort findet sich auch die Einstellung
  **Link-Verhalten**: Links in Beiträgen und Seiten öffnen standardmäßig in einem
  neuen Tab; das lässt sich per Häkchen umstellen.
  Die Seiten Impressum und Datenschutzerklärung sind an den Rechtsstand 2026
  angepasst (DDG, MStV, DSGVO/TDDDG); inhaltliche Änderungen (z. B. neue
  Ansprechpartner) können direkt dort gepflegt werden.
- **Aktive Mannschaft:** Sind unter „Mitglieder" keine Personen in der Gruppe
  „Aktive Mannschaft" angelegt, wird der Abschnitt auf der öffentlichen
  „Über uns"-Seite automatisch ausgeblendet.
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

## Besucherstatistik

Die Übersichtsseite des internen Bereichs zeigt eine **anonyme, cookielose
Besucherstatistik**: Seitenaufrufe und Besucher pro Tag (Diagramm, wählbar 7/30/90
Tage), Aufrufe heute, meistbesuchte Seiten und externe Herkunft (z. B. Google).

- Komplett eingebaut, kein Fremdanbieter, kein Cookie-Banner nötig: Besucher werden
  pro Tag über eine Prüfsumme aus IP + Browser-Kennung + täglich wechselndem
  Zufallswert erkannt; gespeichert werden nur Tagessummen, keine IP-Adressen.
- Suchmaschinen-Bots, der interne Bereich und **angemeldete Redakteure** (im selben
  Browser) werden nicht mitgezählt.
- Die Datenschutzerklärung enthält den passenden Abschnitt („Anonyme
  Besucherstatistik").

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

Alle veränderlichen Daten (Datenbank `data.db` + Ordner `uploads/`) liegen im
Container unter **`/app/data`** (steuerbar über die Umgebungsvariable `DATA_DIR`)
und bleiben im Volume `ffk-data` erhalten – auch bei Image-Updates. Details siehe
`Dockerfile` und `docker-compose.yml`.

## Betrieb bei Timme Hosting (ScaleServer, Container Hosting)

Timme Hosting unterstützt kein Node.js im klassischen Webhosting – die Seite läuft
dort stattdessen über das kostenlos enthaltene **Container Hosting** (ISPConfig).

**Automatischer Image-Build:** Bei jedem Merge auf `main` baut GitHub Actions
(`.github/workflows/docker-image.yml`) das fertige Docker-Image und veröffentlicht
es als `ghcr.io/mirr23/ff-kirchberg-homepage:latest`.
Einmalig nötig: Nach dem ersten Workflow-Lauf das Paket auf GitHub öffentlich
stellen (Profil → Packages → `ff-kirchberg-homepage` → Package settings →
Change visibility → Public), damit der Server es ohne Anmeldung ziehen kann.

**Einrichtung im ISPConfig-Panel:**

1. Container-Modul aktivieren: *System → Benutzerverwaltung → ISPConfig-Benutzer →
   Benutzer wählen → Module → „Container" anhaken → speichern*, dann ab- und wieder
   anmelden (bei neu ausgelieferten Servern für den Admin bereits aktiv).
2. Neuen Container anlegen mit:
   - **Image:** `ghcr.io/mirr23/ff-kirchberg-homepage:latest`
   - **Interner Port:** `5000`
   - **Umgebungsvariablen:** `NODE_ENV=production`, `PORT=5000`, `AUTO_MIGRATE=1`
     (nach dem ersten erfolgreichen Start auf `0` stellen)
   - **Volume:** dauerhaftes Volume auf **`/app/data`** (enthält Datenbank + Bilder)
3. Die Website/Domain in ISPConfig als (Reverse-)Proxy auf den Container-Port 5000
   legen; HTTPS übernimmt der vorgeschaltete nginx von Timme.
4. Upload-Limit der Website auf ca. **35 MB** stellen (nginx `client_max_body_size`),
   sonst scheitern große Handy-Foto-Uploads der Redakteure.
5. Nach dem ersten Start: mit den Standard-Zugangsdaten anmelden, Passwörter ändern,
   `AUTO_MIGRATE` auf `0` stellen und den Container neu starten.

**Update auf eine neue Version:** In ISPConfig das Container-Image neu ziehen
(latest) und den Container neu starten – Inhalte bleiben dank Volume erhalten.
Bei Detailfragen zu den Panel-Masken hilft die Timme-Anleitung „Container Hosting"
bzw. der Timme-Support.

**Backup:** das Volume `/app/data` sichern (enthält `data.db` und `uploads/`) –
ISPConfig bietet dafür tägliche Backups an.

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
