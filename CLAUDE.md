# FF-Kirchberg-Homepage

Website der Freiwilligen Feuerwehr Kirchberg (Migration von WordPress).
Funktionsumfang, Zugangsdaten und Betrieb: siehe `BETRIEB.md`.

## Zusammenarbeit mit dem Benutzer (WICHTIG)

- **Vor Architektur-Entscheidungen den Benutzer fragen und die Auswirkungen
  erklären** – insbesondere alles, was den Betrieb/das Hosting betrifft
  (Laufzeitumgebung, Datenbank, Deployment-Modell, externe Dienste, Kosten).
  Hintergrund: Die erste Fassung wurde mit Node.js/Express gebaut, der Zielserver
  (Timme Hosting ScaleServer, Managed nginx) kann aber nur PHP + MariaDB – das
  erzwang einen kompletten Backend-Umbau. Solche Weichenstellungen immer vorab
  abstimmen.
- Der Benutzer entscheidet per Zuruf über PR-Erstellung und Merge; nicht
  ungefragt mergen.
- Antworten und Commit-Messages auf Deutsch; der Benutzer ist technisch
  interessiert, aber kein Vollzeit-Entwickler – Auswirkungen verständlich
  erklären.

## Technischer Rahmen

- **Zielserver:** Timme Hosting ScaleServer – Managed nginx, **kein Node.js zur
  Laufzeit**, PHP 8.5 + MariaDB, Deployment klassisch über den Web-Ordner
  (keine nginx-Rewrites voraussetzen).
- **Frontend:** React 18 + Vite + Tailwind, SPA mit Hash-Routing; Änderungen am
  bestehenden Stil/Muster ausrichten (deutsche UI-Texte, data-testid-Attribute).
- Die Node.js/Express-Fassung des Backends ist im Branch `nodejs-express-version`
  archiviert (dort auch Docker/Render-Deployment); `main` ist maßgeblich.
- Vor Commits: `npm run check` (tsc) und Build ausführen; Features nach Möglichkeit
  end-to-end testen (Playwright: Chromium unter `/opt/pw-browsers/chromium`).
