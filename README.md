# FF Kirchberg Homepage

Moderne, responsive Website der Freiwilligen Feuerwehr Kirchberg (Erdinger Holzland) mit
integriertem Verwaltungsbereich. Nachfolger der bisherigen WordPress-Seite
[ff-kirchberg.de](https://www.ff-kirchberg.de/) – alle Inhalte wurden vollständig migriert.

## Funktionsumfang

**Öffentliche Website** (dunkles Design, mobil & Desktop)

- Startseite mit Hero, Einsatz-Ticker, neuesten Beiträgen und Terminen
- Aktuelles mit Kategoriefiltern (Einsätze, First Responder, Veranstaltungen, Pressemeldungen, Allgemein)
- Einsatzberichte mit Jahresfilter, Beitragsarchiv nach Jahren
- Gerätehaus mit Fahrzeugen (LF 10/6, TSF 8, MZF)
- Über uns (Texte + Vorstandschaft/Aktive), Chronik, Historische Brände
- Termine & Veranstaltungen, Links, Impressum, Datenschutz

**Interner Bereich** (`/#/intern`)

- Login mit Benutzern, Rollen und Berechtigungen pro Bereich (Vergabe durch Admin)
- Startseite pflegen: Hero-Bild (eigenes Bild oder automatisch das neueste Einsatzbild), Überschrift, Einleitungstext, Abdunkelung, Alt-Text
- Beiträge/Einsätze pflegen: Rich-Text-Editor mit Bild-Upload, Titelbild, Einsatzstichwort/-ort, Entwürfe
- Termine, Fahrzeuge, Mitglieder, Seitentexte und Bilder-Mediathek pflegen
- Automatische Bildoptimierung beim Upload (max. 1600 px, WebP, Metadaten inkl. GPS entfernt)
- Benutzerverwaltung inkl. Passwort-Reset durch Admin, Selbstbedienung „Passwort ändern"

Details zu Bedienung und Betrieb: siehe **[BETRIEB.md](BETRIEB.md)**.

## Technik

| Ebene     | Technologie                                                                   |
| --------- | ----------------------------------------------------------------------------- |
| Frontend  | React 18, Vite, Tailwind CSS, shadcn/ui, wouter (Hash-Routing), TanStack Query |
| Backend   | PHP 8 (getestet mit 8.4, ausgelegt für 8.5), PDO                              |
| Datenbank | MariaDB / MySQL (utf8mb4)                                                     |
| Bilder    | Imagick, ersatzweise GD (Verkleinerung, WebP, Metadaten entfernen)            |
| Auth      | Token-basiert (Bearer), Passwörter mit `password_hash()`                      |

Die Seite läuft auf gewöhnlichem PHP-Webhosting: Dateien in den Web-Ordner
laden, Datenbank-Zugangsdaten in `config.php` eintragen, fertig. Kein Node.js
auf dem Server, kein Docker, kein dauerhaft laufender Prozess und keine
nginx-Rewrites nötig.

### Projektstruktur

```
client/            React-Frontend
  src/pages/       Öffentliche Seiten (home, posts, info)
  src/pages/admin/ Verwaltungsbereich (core, posts, content, manage)
  src/components/  Layout, Karten, Rich-Text-Editor, shadcn/ui
  src/lib/         auth.tsx (Anmeldung + Adressbildung), queryClient, sanitize
shared/schema.ts   Datenmodell als TypeScript-Typen
api.php            Front-Controller für alle API-Endpunkte
datei.php          Downloads über den stabilen Link
php/               Backend (Datenbank, Auth, Routen, Bilder, Statistik, Migration)
migration-data/    WordPress-Export der alten Website
uploads/           Bilder & PDFs (wp/ = migriert, neu/ = Uploads, dokumente/ = Downloads)
tests/e2e.mjs      End-to-End-Test (Playwright)
BETRIEB.md         Betriebs- und Übergabedokumentation
```

## Entwicklung

```bash
npm install
php -S 127.0.0.1:8000 -t .   # Backend (braucht config.php, siehe config.example.php)
npm run dev                   # Frontend mit Hot Reload auf Port 5173
```

Standard-Logins siehe BETRIEB.md (bitte nach Inbetriebnahme ändern).

## Deployment

```bash
npm run build     # -> dist/deploy/ + dist/ffk-homepage-{komplett,update}.zip
```

Das ZIP enthält genau den Inhalt für den Web-Ordner. Denselben Schritt führt
GitHub Actions bei jedem Push auf `main` aus; das Ergebnis liegt dort unter
**Actions → Artifacts** zum Herunterladen bereit.

Schritt-für-Schritt-Anleitung für die Installation bei Timme Hosting:
**[BETRIEB.md](BETRIEB.md)**.

## Testen

```bash
npm run check                 # TypeScript
node tests/e2e.mjs            # End-to-End gegen dist/deploy (Playwright)
find . -name "*.php" -not -path "./node_modules/*" -print0 | xargs -0 -n1 php -l
```

## Datenbank neu aufbauen

Die Datenbank füllt sich beim ersten Aufruf der Website automatisch aus
`migration-data/json/` (WordPress-Export) und den Bildern in `uploads/wp/`:
Kategorien, Beiträge, Seiten, Fahrzeuge, Beispiel-Mitglieder/-Termine sowie die
Standard-Benutzer. Um von vorn zu beginnen, die Tabellen der Datenbank leeren –
beim nächsten Aufruf läuft die Erstbefüllung erneut. Abschaltbar über
`'auto_migrate' => false` in `config.php`.

## Vorherige Fassung

Der Stand vor dem PHP-Umbau (Node.js/Express + SQLite, Docker, Render) liegt
vollständig im Branch **`nodejs-express-version`**.

Eine Bewertung des Projekts (Stärken, Verbesserungen, umgesetzte Änderungen) steht in
**[BEWERTUNG.md](BEWERTUNG.md)**.

## Hinweise

- **Mitglieder (Vorstandschaft/Aktive)** sind bewusst nur Beispieldaten – echte Daten im internen Bereich pflegen.
- **Termine** enthalten Beispieleinträge.
- **Impressum/Datenschutz** wurden 1:1 übernommen und sollten vor Go-Live geprüft werden.
- Hash-Routing (`/#/…`) ist absichtlich gewählt, damit die Seite ohne Server-Rewrites überall lauffähig ist.
