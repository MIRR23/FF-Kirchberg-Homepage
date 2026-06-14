# Bewertung der neuen FF-Kirchberg-Homepage

Stand: Review des kompletten Repositories (Frontend, Backend, Migration, Betrieb).
Dieses Dokument fasst zusammen, **was gelungen ist**, **wo Verbesserungspotenzial besteht**
und **welche Änderungen in diesem Branch bereits umgesetzt** wurden.

---

## 1. Gesamteindruck

Ein sehr solider, durchdachter Neuentwurf. Die Anwendung ist vollständig lauffähig:
Build, Migration (187 Beiträge, 456 Medien), Server, Login und API wurden im Rahmen
des Reviews erfolgreich getestet. Architektur und Code sind aufgeräumt, konsistent
und gut dokumentiert (README, BETRIEB.md). Der Funktionsumfang inklusive eigenem
CMS/internem Bereich mit Rollen- und Rechtesystem ist für einen Feuerwehrverein
überdurchschnittlich.

**Technik:** React 18 + Vite + Tailwind + shadcn/ui (Frontend), Express + Drizzle ORM
+ SQLite + Sharp (Backend), Token-Auth mit scrypt-Hashing.

---

## 2. Was ist gelungen

- **Saubere Architektur.** Klare Trennung Client/Server/Shared, zentraler
  Datenbankzugriff in `server/storage.ts` (erleichtert späteren MariaDB-Umstieg),
  gemeinsames Schema + Zod-Validierung in `shared/schema.ts`.
- **Vollständige Inhaltsmigration.** Die WordPress-Inhalte werden reproduzierbar
  übernommen; URLs werden auf lokale Kopien umgeschrieben, Vorschaubilder werden
  erzeugt, fehlende Dateien werden (falls die alte Seite erreichbar ist) nachgeladen.
- **Durchdachtes Rechtesystem.** Berechtigungen je Bereich, Sicherheitsnetz gegen
  das Löschen/Deaktivieren des letzten Admins, serverseitige Prüfung pro Route.
- **Sicherheits-Grundlagen vorhanden.** Rate-Limit am Login, Helmet, scrypt mit
  `timingSafeEqual`, Upload-Validierung (echtes Bild via Sharp) und automatische
  Verkleinerung, sichere Dateinamen, Pfad-Prüfung beim Löschen.
- **Gute Performance-Details.** Listen liefern keinen Volltext mit, Eager-Loading
  der ersten sichtbaren Bilder, Lazy-Loading sonst, Vorschaubilder.
- **Gute deutschsprachige UX.** Konsistente Texte, durchdachte Datums-/Zeitformate,
  sinnvolle Lade- und Leerzustände (Skeletons, EmptyStates).
- **Pragmatisches Deployment-Konzept.** Hash-Routing vermeidet Server-Rewrites;
  ein `__PORT_5000__`-Platzhalter erlaubt den Betrieb hinter einem Proxy.

---

## 3. Verbesserungspotenzial

### In diesem Branch bereits umgesetzt ✅

| Bereich | Befund | Umsetzung |
| --- | --- | --- |
| SEO | Kein seitenspezifischer Titel (alle Seiten gleicher `<title>`) | `usePageTitle`-Hook, je Seite gesetzt (Beitrag, Aktuelles, Einsätze, Archiv, Über uns, Termine, Gerätehaus, statische Seiten, 404) |
| SEO/Social | Kein `og:image`, keine Twitter-Cards, kein `og:locale` | In `client/index.html` ergänzt |
| Barrierefreiheit | `maximum-scale=1` verhinderte Zoomen (WCAG-Verstoß) | Auf `maximum-scale=5` geändert |
| Barrierefreiheit | 404-Seite im hellen Design, englisch, ohne Navigation | Neu im dunklen Markendesign, deutsch, mit „Zur Startseite“ |
| Barrierefreiheit | Eingefügte Editor-Bilder ohne Alt-Text; Editor-Feld ohne Rolle | Alt-Text aus Dateiname; `role="textbox"`/`aria-label` ergänzt; dekorative Icons `aria-hidden` |
| Sicherheit (XSS) | Gespeichertes HTML wurde ungefiltert per `dangerouslySetInnerHTML` gerendert | Zentraler `cleanHtml()`-Sanitizer (DOMPurify) an allen Render-Stellen |
| Technik | `npm run check` (tsc) schlug fehl (fehlendes `target`) | `target: ESNext` in `tsconfig.json` – tsc läuft sauber |
| Betrieb | Datenbank musste vor Betrieb manuell migriert werden | Auto-Migration beim Start, wenn die Datenbank leer ist (`AUTO_MIGRATE`) |
| Veröffentlichung | Keine Deploy-Konfiguration | `render.yaml`, `Dockerfile`, `docker-compose.yml`, `.dockerignore` |

### Weiterhin offen / Empfehlungen für später

- **Echte Inhalte statt Beispieldaten.** Mitglieder (Vorstandschaft/Aktive) und Termine
  sind bewusst nur Platzhalter – vor Go-Live im internen Bereich pflegen.
- **Impressum/Datenschutz prüfen.** 1:1 aus der alten Seite übernommen; auf Aktualität
  (Verantwortliche, Anschrift, DSGVO) prüfen lassen.
- **Sitzungs-Persistenz.** Anmeldung gilt nur, solange der Tab offen ist (Token im
  Speicher). Für Komfort ggf. auf `localStorage`/Cookie-Sessions umstellen; dann auch
  Token-Ablauf serverseitig erzwingen.
- **Archiv-Performance.** Die Archiv-Seite lädt alle Beiträge und filtert clientseitig.
  Bei stark wachsender Beitragszahl serverseitige Paginierung erwägen.
- **Bundle-Größe.** Das JS-Bundle ist ~485 kB (gzip ~147 kB). Optional Code-Splitting
  (z. B. Admin-Bereich per `lazy()`), um die öffentliche Seite schlanker zu laden.
- **Strukturierte Daten.** Optional `schema.org`-Markup (Article/Event) für bessere
  Suchmaschinen-Darstellung.
- **Bestätigungsdialoge.** Löschaktionen nutzen `window.confirm()`; ein gestylter Dialog
  wäre konsistenter (UI-Komponenten sind bereits vorhanden).
- **Abhängigkeiten.** `npm audit` meldet Hinweise im Build-Werkzeug (esbuild/vite, nur
  Entwicklung) – unkritisch für den Produktionsbetrieb, bei Gelegenheit aktualisieren.

---

## 4. Veröffentlichung für den Kunden (Vorschau)

Damit der Kunde die Seite ansehen kann, **ohne** vorher die alte Domain umzustellen,
liegt jetzt eine fertige Deploy-Konfiguration für **Render.com** bei (kostenloser Plan).
Schritt-für-Schritt-Anleitung siehe **[BETRIEB.md → Vorschau veröffentlichen](BETRIEB.md)**.

Kurzfassung: Auf render.com mit GitHub anmelden → „New → Blueprint“ → dieses Repository
wählen → Render baut und startet die App automatisch und stellt eine öffentliche
`onrender.com`-URL bereit. Die Inhalte werden beim ersten Start automatisch erzeugt.
