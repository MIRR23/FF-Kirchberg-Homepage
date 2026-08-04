# Übergabe: Umbau des Backends von Node.js/Express auf PHP 8.5 + MariaDB

## Arbeitsmodus (WICHTIG)

Du arbeitest **vollständig autonom über Nacht, ohne Rückfragen an den Benutzer**.
Der Benutzer schläft und erwartet am Morgen ein fertiges, getestetes Ergebnis.
Triff bei Unklarheiten selbst eine sinnvolle Entscheidung im Rahmen dieser Vorgaben
und **dokumentiere jede getroffene Annahme** in deiner Abschlusszusammenfassung.
Arbeite die Abnahmekriterien am Ende dieses Dokuments vollständig ab. Committe und
pushe in sinnvollen Etappen, damit nichts verloren geht.

## Kontext

Dieses Repository enthält die Website der Freiwilligen Feuerwehr Kirchberg:

- **Frontend:** React 18 + Vite + Tailwind (dunkles Design), SPA mit **Hash-Routing**
  (`/#/einsaetze` usw.) – dadurch braucht die Seitennavigation serverseitig KEINE Routen.
- **Backend (bisher):** Node.js/Express + SQLite (`server/*.ts`, `shared/schema.ts`).
- **Betriebsdoku:** `BETRIEB.md` (Funktionsumfang, Zugangsdaten, bisherige Deployments).

**Problem:** Der Zielserver ist ein **Timme Hosting ScaleServer** – Managed nginx-Hosting,
das **kein Node.js** ausführt, nur **PHP (Zielversion 8.5)** und **MariaDB**. Der Benutzer
will die Seite „klassisch" betreiben: Dateien in den Web-Ordner laden, fertig – kein
Docker, kein dauerhafter Prozess.

## Auftrag

Baue das Backend vollständig auf **PHP + MariaDB (PDO)** um, bei **unverändertem
Funktionsumfang und unverändertem Frontend-Verhalten**. Das Frontend bleibt React
(statischer Vite-Build); es darf nur dort angepasst werden, wo API-Aufrufe auf das
neue URL-Schema umgestellt werden müssen (eine zentrale Adapter-Stelle, siehe unten).

### Schritt 0 – Branch-Strategie (ZUERST, vor allem anderen)

1. Erzeuge vom aktuellen `main` einen Branch **`nodejs-express-version`** und pushe ihn.
   Er konserviert die komplette Node.js-Fassung (inkl. Docker/Render/GitHub-Action).
2. Der PHP-Umbau erfolgt danach auf deinem Arbeits-Branch; **Endzustand: `main`
   enthält die PHP-Version** (per PR mergen).
3. Hinweis für die Doku: Die Render-Vorschau und der Docker-Image-Workflow beziehen
   sich auf die Node-Fassung → aus `main` entfernen; sie leben im Branch
   `nodejs-express-version` weiter.

### Ziel-Deploystruktur (Web-Ordner, ohne Rewrites)

Die Auslieferung muss **ohne nginx-Rewrites** funktionieren (Managed Hosting!).
Struktur des Ordners, der am Ende per SFTP in den Web-Ordner geladen wird:

```
/index.html + /assets/…       ← Vite-Build des Frontends (unverändert statisch)
/api.php                      ← EIN Front-Controller für alle API-Endpunkte
/datei.php                    ← Auslieferung der Dokumente mit stabilem Link
/uploads/…                    ← Bilder/Dokumente (nginx liefert direkt aus)
/config.php                   ← DB-Zugangsdaten etc. (NICHT im Repo, s. u.)
```

- **Routing im Front-Controller:** Bevorzugt `PATH_INFO` (`/api.php/posts/slug/xyz`);
  baue zusätzlich einen automatischen Fallback über Query-Parameter
  (`/api.php?r=/posts/slug/xyz`), falls PATH_INFO auf dem Zielserver nicht
  konfiguriert ist. Der Client probiert das transparent (oder nutzt von vornherein
  die Query-Variante – entscheide nach Testbarkeit, dokumentiere die Wahl).
- **Frontend-Anpassung dafür an EINER Stelle:** In `client/src/lib/auth.tsx` (und
  `queryClient.ts`) laufen alle API-Aufrufe durch `withBase()`/`authQueryFn`/
  `authRequest`/`uploadFiles`. Baue dort eine Funktion `apiUrl(path)` ein, die
  `/api/...`-Pfade auf das neue Schema abbildet. Die übrigen ~30 Client-Dateien
  bleiben unangetastet. Beachte auch den Statistik-Ping in `App.tsx` und die
  Dokument-Uploads in `manage.tsx` (eigene fetch-Aufrufe).
- **Stabile Datei-Links:** `/dateien/<slug>` wird zu `/datei.php?s=<slug>` (Verhalten
  identisch: Content-Disposition, no-cache, PDF/Bilder inline). Der „Link
  kopieren"-Button im Adminbereich und `rewriteContent()`/Editor müssen das neue
  Format erzeugen bzw. weiterhin erkennen. Dokumentiere in `BETRIEB.md` optional
  nginx-Direktiven, mit denen Timme später hübsche URLs (`/api/…`, `/dateien/…`)
  aktivieren könnte – die Seite muss aber OHNE sie voll funktionieren.
- `config.example.php` ins Repo (Platzhalter für DB-Host/Name/User/Passwort,
  APP-Umgebung); `config.php` in `.gitignore`. Der Benutzer füllt sie am Server aus.

### Datenbank: MariaDB (PDO, utf8mb4)

Portiere das Schema aus `shared/schema.ts` 1:1 (Spaltennamen in snake_case wie
bisher): `users`, `auth_tokens`, `categories`, `posts`, `events`, `vehicles`,
`members`, `pages`, `settings`, `media`, `documents`, `stats_days`, `stats_pages`,
`stats_referrers`, `stats_seen`. Beachte: `posts`/`events` haben `lat`/`lng` (DOUBLE),
`documents` hat den stabilen `slug`. Baue eine **idempotente Schema-Anlage** beim
ersten Request (CREATE TABLE IF NOT EXISTS + Spalten-Nachrüstung wie bisher in
`server/storage.ts`), damit „Dateien hochladen + config füllen" als Installation reicht.

### Feature-Parität (vollständige Checkliste)

Alle Endpunkte verhalten sich wie die bisherigen in `server/routes.ts` (Referenz!):

**Öffentlich:** `POST /api/auth/login` (Rate-Limit!), `POST /api/auth/logout`,
`GET /api/auth/me`, `POST /api/auth/change-password`, `GET /api/categories`,
`GET /api/posts` (Filter: category, year, einsatz, limit; `content` in Listen leeren),
`GET /api/posts/years`, `GET /api/posts/slug/:slug` (nur published),
`GET /api/events`, `GET /api/vehicles`, `GET /api/members`, `GET /api/pages/:slug`,
`GET /api/settings/hero`, `GET /api/settings/site`, `GET /api/stats`,
`POST /api/stats/hit`, Datei-Auslieferung (bisher `GET /dateien/:slug`).

**Admin (Bearer-Token):** CRUD Beiträge (Slug-Erzeugung + Eindeutigkeit, Slug nie
ändern, Rechteprüfung nach Kategorie einsaetze/neuigkeiten), CRUD Termine/Fahrzeuge/
Mitglieder, Seiten (GET/PATCH, Slug stabil), `PUT settings/hero` + `PUT settings/site`,
Mediathek (GET/POST multipart `files[]` max. 20/30 MB, DELETE mit Berechtigung
`medien`), Dokumente (GET für alle Angemeldeten; POST/PATCH/DELETE mit Berechtigung
`dateien`; Austauschen ersetzt Datei, Slug/Link bleibt, alte Datei löschen;
Typ-Whitelist wie bisher, KEINE html/svg; 25 MB), Benutzerverwaltung (nur Admin;
letzten aktiven Admin schützen), `GET /api/admin/stats?days=N` (lückenlose
Tagesreihe, Top-Seiten mit Titel-Auflösung, Referrer).

**Querschnitt:**
- **Auth:** Bearer-Token in `auth_tokens` (30-Tage-Ablauf wie bisher, abgelaufene
  aufräumen), Passwörter mit `password_hash()`/`password_verify()`. Die alten
  scrypt-Hashes sind NICHT übertragbar – die Migration legt Benutzer wie bisher
  frisch an (Zugangsdaten wie in `BETRIEB.md`).
- **Berechtigungen:** `PERMISSION_AREAS` = einsaetze, neuigkeiten, termine,
  fahrzeuge, mitglieder, seiten, medien, dateien. Admin hat alles.
- **Bildoptimierung beim Upload** (Parität zu `optimizeImage()` in routes.ts):
  EXIF-Drehung anwenden, max. 1600 px Kante, WebP Qualität ~82, **alle Metadaten
  inkl. GPS entfernen**, GIF unverändert lassen. Bevorzugt Imagick, Fallback GD
  (beide zur Laufzeit erkennen; auf dem Zielserver ist mindestens GD vorhanden).
- **Besucherstatistik** (Parität zu routes.ts/storage.ts): cookielos, Tages-Hash aus
  `salt|ip|user-agent` (SHA-256), Salt täglich rotieren (in `settings` speichern,
  alte `stats_seen` beim Wechsel löschen), Bot-Filter per User-Agent-Regex,
  `/intern`-Pfade nicht zählen, Tagesgrenzen **Europe/Berlin**.
- **Auto-Migration:** Portiere `server/migrate.ts` nach PHP: Bei leerer Datenbank
  Inhalte aus `migration-data/json/*.json` + Bilder aus `uploads/wp/` übernehmen
  (inkl. Kategorien-Konfiguration, Thumbnail-Erzeugung, Seiten aus
  `server/content.ts` – Impressum/Datenschutz/First-Responder-Texte 1:1 übernehmen,
  Fahrzeug-Reihenfolge LF 10/6, MZF, TSF 8, Beispiel-Termine/-Mitglieder, Benutzer).
  Seite `first-responder` auch in bestehenden DBs nachziehen (idempotent).
- **Sicherheit:** PDO-Prepared-Statements überall, Upload-Dateinamen säubern wie
  bisher, Security-Header (X-Content-Type-Options etc.), Login-Rate-Limit
  (DB-basiert, z. B. 20 Versuche/15 Min pro IP), keine Fehlerausgabe mit
  Interna an Clients, deutsche Fehlermeldungen wie bisher.

### Aufräumen im PHP-`main`

- `server/*.ts`, `Dockerfile`, `docker-compose.yml`, `render.yaml`,
  `.github/workflows/docker-image.yml`, `drizzle.config.ts` und Node-only-Abhängig-
  keiten (express, multer, sharp, better-sqlite3, drizzle, passport …) entfernen.
  Vite/React/Tailwind-Toolchain bleibt (Frontend-Entwicklung).
- Neuer GitHub-Actions-Workflow: baut das Frontend und packt ein
  **Upload-fertiges ZIP** (Deploystruktur oben) als Artifact/Release – das ist der
  neue „Deployment-Weg" (herunterladen, in den Web-Ordner entpacken).
- `BETRIEB.md` überarbeiten: Installation auf Timme (DB im Panel anlegen,
  `config.php` füllen, PHP-Einstellungen: `upload_max_filesize`/`post_max_size`
  ≥ 35 MB, `memory_limit` ≥ 256 MB), Update-Weg, Backup (DB-Dump + `uploads/`).
- `CLAUDE.md` an die neue Architektur anpassen (Abschnitt „Zusammenarbeit" behalten!).

### Tests (Pflicht, wie in diesem Projekt üblich)

- Lokal: MariaDB installieren (`apt-get install mariadb-server`) und PHP-Builtin-
  Server (`php -S`) als Test-Umgebung; statische Dateien + `api.php` zusammen
  betreiben. Falls MariaDB lokal partout nicht läuft: SQLite-PDO als Test-Treiber
  mit kompatiblem SQL, aber MariaDB-SQL im Code belassen und das dokumentieren.
- **End-to-End mit Playwright** (Chromium liegt unter `/opt/pw-browsers/chromium`,
  globales Playwright unter `/opt/node22/lib/node_modules/playwright/index.mjs`):
  Migration läuft durch; öffentliche Seiten rendern mit Inhalten/Bildern; Login;
  Beitrag mit großem Foto anlegen (Foto wird WebP ≤1600 px, EXIF/GPS entfernt);
  Datei hochladen → stabiler Link liefert Datei, Austauschen behält Link;
  Karte setzen/anzeigen; Termine; Statistik zählt (Ping öffentlich ja, angemeldet
  nein, Bot nein) und Dashboard zeigt Diagramm; Benutzer anlegen/Rechte;
  Seiten bearbeiten; Link-in-neuem-Tab-Einstellung.
- `npm run check` (tsc) und Frontend-Build grün; PHP-Dateien mit `php -l` prüfen.

### Abnahmekriterien (am Morgen erfüllt)

1. Branch `nodejs-express-version` = alter Stand, gepusht.
2. `main` = PHP-Version, per gemergtem PR, ohne Node-Server-Reste.
3. Alle Tests oben ausgeführt und bestanden (im PR/Abschlussbericht dokumentiert).
4. ZIP-Build-Workflow läuft grün; `BETRIEB.md` beschreibt die Timme-Installation
   Schritt für Schritt für einen Laien.
5. Abschlussbericht: was getan, welche Annahmen, was der Benutzer noch tun muss
   (DB anlegen, config.php füllen, ZIP entpacken, Passwörter ändern).

## Bekannte Stolperfallen

- Die SPA nutzt **Hash-Routing** – Deep-Links brauchen serverseitig nichts; nur
  `/api.php`, `/datei.php` und `/uploads/` müssen erreichbar sein.
- `client/src/lib/auth.tsx` enthält den `__PORT_5000__`-Mechanismus (API_BASE) für
  die alte Vorschau – beim Umbau der URL-Bildung berücksichtigen/vereinfachen.
- Editor (`editor.tsx`) und `rewriteContent()`/`sanitize.ts` verarbeiten
  `/uploads/`- und `/dateien/`-Pfade in gespeichertem HTML – ans neue Schema
  anpassen, Bestandsinhalte (Migration erzeugt `/uploads/…`) müssen weiter laufen.
- `uploads/` enthält ~460 mitgelieferte Bilder (Repo) – im Deploy-ZIP enthalten.
- Der Statistik-Endpunkt antwortet sofort 204 und zählt danach – Zählung darf
  Besucher nie ausbremsen.
