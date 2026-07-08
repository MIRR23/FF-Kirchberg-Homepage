# Design-Entwürfe

`design-entwuerfe.html` ist eine eigenständige Datei (einfach im Browser öffnen –
keine Installation nötig) mit drei umschaltbaren Gestaltungsrichtungen für die
Homepage, als Auswahl für den Kunden. Fotos, Beitragstitel, Termine und
Seitenstruktur entsprechen den echten Inhalten.

| Entwurf | Charakter | Kurzbeschreibung |
| --- | --- | --- |
| **A · Chronik** | klassisch, hell | Serifenschrift, Messing-Doppellinien, gerahmte Fotos – betont die Vereinsgeschichte seit 1874 |
| **B · Weißraum** | modern, editorial | Magazin-Look: viel Luft, große Zahlen, Signalrot nur als Akzent |
| **C · Signal** | plakativ, kräftig | Farbblöcke in Rot/Schwarz, Warnstreifen, Versal-Schlagzeilen – Einsatz-Charakter |

Das aktuelle Live-Design (dunkel, Rot/Amber) bleibt unverändert bestehen.

## Umsetzung eines Entwurfs

Alle drei Entwürfe verwenden dieselbe Seitenstruktur wie die bestehende App
(Header, Hero, Ticker/Statistik, Beiträge, Termine, Footer). Eine Umsetzung ist
daher im Wesentlichen ein **Re-Theming**:

1. Farb-Tokens in `client/src/index.css` (CSS-Variablen) auf die Palette des
   gewählten Entwurfs umstellen.
2. Schriften anpassen (Entwurf A: Serife für Überschriften; B: kräftige
   Grotesk; C: Versal-Überschriften) – Einbindung wie bisher in `client/index.html`.
3. Punktuelle Layout-Anpassungen in `client/src/components/site.tsx` und
   `client/src/pages/home.tsx` (z. B. zentriertes Masthead bei A, asymmetrischer
   Hero bei B, Warnstreifen/Farbblöcke bei C).

Aufwand pro Entwurf grob: A/B ca. 1 Arbeitstag, C ca. 1–1,5 Arbeitstage.
