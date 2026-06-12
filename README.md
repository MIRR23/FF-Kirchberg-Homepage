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
- Beiträge/Einsätze pflegen: Rich-Text-Editor mit Bild-Upload, Titelbild, Einsatzstichwort/-ort, Entwürfe
- Termine, Fahrzeuge, Mitglieder, Seitentexte und Bilder-Mediathek pflegen
- Automatische Bildverkleinerung beim Upload (max. 1600 px)
- Benutzerverwaltung inkl. Passwort-Reset durch Admin, Selbstbedienung „Passwort ändern"

Details zu Bedienung und Betrieb: siehe **[BETRIEB.md](BETRIEB.md)**.

## Technik

| Ebene     | Technologie                                                        |
| --------- | ------------------------------------------------------------------ |
| Frontend  | React 18, Vite, Tailwind CSS, shadcn/ui, wouter (Hash-Routing), TanStack Query |
| Backend   | Node.js, Express, Drizzle ORM, Multer + Sharp (Bild-Uploads)        |
| Datenbank | SQLite (`data.db`) – Umstieg auf MariaDB vorgesehen, siehe BETRIEB.md |
| Auth      | Token-basiert (Bearer), Passwörter mit scrypt gehasht               |

### Projektstruktur

```
client/            React-Frontend
  src/pages/       Öffentliche Seiten (home, posts, info)
  src/pages/admin/ Verwaltungsbereich (core, posts, content, manage)
  src/components/  Layout, Karten, Rich-Text-Editor, shadcn/ui
  src/lib/         Auth-Context, API-Helfer, Formatierung
server/
  index.ts         Express-Bootstrap (vom Template)
  routes.ts        Alle API-Routen inkl. Auth & Berechtigungsprüfung
  storage.ts       Datenbankzugriff (zentral, hier MariaDB-Umstieg ansetzen)
  auth.ts          Passwort-Hashing, Token, Middleware
  migrate.ts       Migration der alten WordPress-Inhalte
shared/schema.ts   Datenmodell (Drizzle) + Zod-Schemas + Berechtigungs-Bereiche
migration-data/    WordPress-Export (JSON) der alten Website
uploads/           Bilder & PDFs (wp/ = migriert, wp/thumbs/ = Vorschaubilder, neu/ = Uploads)
BETRIEB.md         Betriebs- und Übergabedokumentation
```

## Entwicklung

```bash
npm install
npm run dev          # Dev-Server (Frontend + API) auf Port 5000
```

Standard-Logins siehe BETRIEB.md (bitte nach Inbetriebnahme ändern).

## Produktion

```bash
npm run build
NODE_ENV=production PORT=5000 node dist/index.cjs
```

`uploads/` und `data.db` liegen im Projektverzeichnis und müssen mitgesichert werden.

## Datenbank neu aufbauen (Migration)

Die Datenbank (`data.db`) ist nicht im Repository. Sie lässt sich jederzeit vollständig
aus den mitgelieferten Daten erzeugen:

```bash
npx tsx server/migrate.ts
```

Das Skript nutzt `migration-data/json/` (WordPress-Export) und die bereits in
`uploads/wp/` liegenden Mediendateien, erzeugt Vorschaubilder, legt Kategorien,
Beiträge, Seiten, Fahrzeuge, Beispiel-Mitglieder/-Termine sowie die Standard-Benutzer an.
Fehlende, in Inhalten verlinkte Dateien werden – falls die alte Website noch erreichbar
ist – automatisch nachgeladen.

## Hinweise

- **Mitglieder (Vorstandschaft/Aktive)** sind bewusst nur Beispieldaten – echte Daten im internen Bereich pflegen.
- **Termine** enthalten Beispieleinträge.
- **Impressum/Datenschutz** wurden 1:1 übernommen und sollten vor Go-Live geprüft werden.
- Hash-Routing (`/#/…`) ist absichtlich gewählt, damit die Seite ohne Server-Rewrites überall lauffähig ist.
