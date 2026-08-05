# CLAUDE.md

Hinweise für die Arbeit mit Claude Code in diesem Repository.

## Zusammenarbeit

- **Sprache:** Alles, was Menschen lesen, ist auf Deutsch – Oberfläche,
  Fehlermeldungen, Kommentare, Commit-Nachrichten, Dokumentation.
  Bezeichner im Code bleiben englisch (`listPosts`, `ffk_get_document`).
- **Zielgruppe:** Die Seite pflegen ehrenamtliche Feuerwehrleute, kein
  IT-Personal. Oberfläche und Doku müssen ohne Vorwissen verständlich sein.
  Fehlermeldungen sagen, was zu tun ist – nicht, was technisch schiefging.
- **Kommentare** erklären das *Warum*, nicht das *Was*. Sie stehen dort, wo
  eine Entscheidung nicht offensichtlich ist (z. B. warum `PATCH` als `POST`
  gesendet wird). Keine Kommentare, die den Code nacherzählen.
- **Änderungen klein halten:** Nur anfassen, was zur Aufgabe gehört.
  Keine Umbenennungen, Formatierungsläufe oder Refactorings nebenbei.
- **Testen gehört dazu:** Vor dem Abschluss `npm run check`, `php -l` und –
  bei funktionalen Änderungen – der End-to-End-Test aus `tests/e2e.mjs`.
- **Nichts erfinden:** Inhalte (Mitglieder, Termine, Impressum) stammen von
  der Feuerwehr. Beispieldaten sind als solche gekennzeichnet.

## Architektur

Statisches React-Frontend + PHP-Backend, das ohne dauerhaften Prozess und
ohne Server-Rewrites auskommt (Managed Hosting bei Timme, PHP 8 + MariaDB).

```
client/            React-Frontend (Vite, Tailwind, wouter mit Hash-Routing)
  src/pages/       Öffentliche Seiten (home, posts, info)
  src/pages/admin/ Interner Bereich (core, posts, content, manage, startseite)
  src/components/  Layout, Karte, Rich-Text-Editor, shadcn/ui
  src/lib/         auth.tsx (Auth + Adressbildung), queryClient, sanitize
shared/schema.ts   Datenmodell als TypeScript-Typen (nur Typen, kein ORM)

api.php            Front-Controller für alle API-Endpunkte
datei.php          Downloads über den stabilen Link
php/
  bootstrap.php    Konfiguration, Sicherheits-Header, Fehlerbehandlung
  db.php           PDO-Verbindung + idempotente Schema-Anlage
  storage.php      Datenzugriff (snake_case-Spalten -> camelCase-Felder)
  auth.php         Passwörter, Token, Berechtigungen, Rate-Limit
  routes.php       alle Endpunkte + Upload-Verarbeitung
  validate.php     Prüfung der Eingabedaten (ersetzt Zod)
  images.php       Bildoptimierung (Imagick, sonst GD)
  stats.php        anonyme Besucherstatistik
  migrate.php      Erstbefüllung aus migration-data/
  content.php      feste Seitentexte (Impressum, Datenschutz, First Responder)

migration-data/    WordPress-Export der alten Website
uploads/           Bilder und Dokumente
tests/e2e.mjs      End-to-End-Test mit Playwright
script/build-deploy.mjs  baut das Upload-fertige Paket
```

## Regeln, die leicht übersehen werden

- **Hash-Routing:** Die SPA nutzt `/#/einsaetze`. Deep-Links brauchen
  serverseitig nichts – nur `api.php`, `datei.php` und `uploads/` müssen
  erreichbar sein. Nicht auf History-Routing umstellen.
- **Adressbildung nur an einer Stelle:** `apiUrl()`, `fileUrl()` und
  `apiFetch()` in `client/src/lib/auth.tsx`. Neue Aufrufe gehen darüber,
  nirgends direkt `fetch("/api/...")`.
- **`PATCH`/`PUT`/`DELETE`** werden als `POST` mit `_method` gesendet
  (PHP wertet multipart nur bei `POST` aus). Nicht „vereinfachen".
- **Mehrfach-Uploads** heißen `files[]`, sonst sieht PHP nur die letzte Datei.
- **Slugs sind stabil.** Beitrags-, Seiten- und Dokument-Slugs werden nach dem
  Anlegen nie geändert – daran hängen veröffentlichte Links.
- **Alle Datenbankzugriffe über Prepared Statements** (`ffk_exec`, `ffk_row`,
  `ffk_all`). Nie Werte in SQL einsetzen; `LIMIT` nur aus geprüften Zahlen.
- **Keine Interna an den Client.** Fehler kommen als deutsche Meldung,
  Details gehen per `error_log()` ins Server-Protokoll.
- **Bilder:** Beim Upload immer optimieren (max. 1600 px, WebP, Metadaten
  inkl. GPS entfernen). GIFs bleiben unangetastet. Kann der Server kein WebP,
  wird auf JPEG/PNG ausgewichen – ein fehlender Kodierer darf Uploads nie
  komplett verhindern. Fehlermeldungen nennen Datei und Grund.
- **Statistik bremst nie:** Der Zähl-Ping antwortet sofort mit 204 und zählt
  danach (`ffk_finish_request()`).
- **`config.php` gehört nicht ins Repository** – nur `config.example.php`.
- **Uploads sind Bestand:** `uploads/` enthält ~460 migrierte Bilder und
  gehört ins Deployment-Paket. Nicht aus dem Repository entfernen.

## Häufige Befehle

```bash
npm install
php -S 127.0.0.1:8000 -t .   # Backend für die Entwicklung
npm run dev                   # Frontend mit Hot Reload (Proxy auf Port 8000)
npm run check                 # TypeScript prüfen
npm run build                 # Deployment-Paket + ZIPs nach dist/
npm run build:dir             # nur dist/deploy (ohne ZIP)
node tests/e2e.mjs            # End-to-End-Test gegen dist/deploy
php tests/bilder.php          # Bildverarbeitung des Servers prüfen
find . -name "*.php" -not -path "./node_modules/*" -print0 | xargs -0 -n1 php -l
```

Betrieb, Installation und Bedienung: **BETRIEB.md**.
Die frühere Node.js/Express-Fassung liegt im Branch `nodejs-express-version`.
