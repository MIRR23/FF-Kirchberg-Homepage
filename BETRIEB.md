# FF Kirchberg – Neue Homepage: Betriebs- und Übergabedokumentation

## Überblick

Moderne, responsive Website mit integriertem Verwaltungsbereich („Interner Bereich").

- **Frontend:** React + Vite + Tailwind CSS (dunkles Design, Rot/Amber-Akzente),
  fertig gebaute statische Dateien (`index.html` + `assets/`)
- **Backend:** PHP 8 (getestet mit 8.4, ausgelegt für 8.5) – zwei Einstiegspunkte:
  `api.php` (alle Daten) und `datei.php` (Downloads)
- **Datenbank:** MariaDB/MySQL über PDO (utf8mb4)
- **Bilder & Dokumente:** Dateisystem unter `uploads/`

Die Seite braucht **keinen dauerhaft laufenden Prozess**, kein Node.js, kein Docker
und **keine nginx-Rewrites**: Dateien in den Web-Ordner laden, `config.php` ausfüllen,
fertig. Das passt genau zum Managed Hosting von Timme (ScaleServer).

---

# Teil 1 – Installation bei Timme Hosting (Schritt für Schritt)

Diese Anleitung ist bewusst für Nicht-Techniker geschrieben. Rechnen Sie mit
etwa 30 Minuten. Sie brauchen: Zugang zum Timme-Kundenpanel und ein
SFTP-Programm (z. B. [FileZilla](https://filezilla-project.org), kostenlos).

## Schritt 1: Das fertige Paket herunterladen

1. Im GitHub-Repository oben auf **Actions** klicken.
2. Links **„Deployment-Paket bauen"** auswählen, dann den obersten (neuesten)
   grünen Eintrag anklicken.
3. Ganz unten unter **Artifacts** auf **`ffk-homepage-komplett`** klicken –
   damit wird eine ZIP-Datei heruntergeladen.
4. Die heruntergeladene Datei entpacken. Darin liegt
   `ffk-homepage-komplett.zip` – **auch diese** entpacken. Sie erhalten einen
   Ordner mit `index.html`, `api.php`, `datei.php`, `assets/`, `php/`,
   `uploads/`, `migration-data/` und `config.example.php`.

> Alternativ: Gibt es unter **Releases** eine Version, kann das ZIP auch dort
> direkt heruntergeladen werden.

## Schritt 2: Datenbank im Timme-Panel anlegen

1. Im Timme-Kundenpanel den Bereich **Datenbanken** öffnen.
2. **Neue Datenbank anlegen** wählen, als Typ **MariaDB** bzw. **MySQL**.
3. Als Zeichensatz **utf8mb4** wählen, falls gefragt wird (sonst Standard lassen).
4. Einen Datenbank-Benutzer anlegen und ein sicheres Passwort vergeben.
5. **Notieren Sie sich diese vier Angaben** – Sie brauchen sie gleich:
   - Datenbank-Server (meist `localhost`)
   - Datenbankname (z. B. `d0123456_ffk`)
   - Benutzername
   - Passwort

## Schritt 3: `config.php` ausfüllen

1. Im entpackten Ordner die Datei **`config.example.php`** in
   **`config.php`** umbenennen.
2. `config.php` mit einem Texteditor öffnen (Windows: Editor/Notepad,
   Mac: TextEdit – **nicht** mit Word).
3. Die vier Platzhalter durch Ihre Angaben aus Schritt 2 ersetzen:

```php
'db_host' => 'localhost',
'db_name' => 'd0123456_ffk',
'db_user' => 'd0123456_user',
'db_pass' => 'IhrPasswort',
```

4. Speichern. Die restlichen Einstellungen können unverändert bleiben.

> **Optional für Fortgeschrittene:** `config.php` kann stattdessen eine Ebene
> **über** dem Web-Ordner liegen. Die Website findet sie dort automatisch, und
> die Zugangsdaten wären selbst dann geschützt, wenn PHP auf dem Server einmal
> nicht ausgeführt würde.

## Schritt 4: PHP-Einstellungen prüfen

Damit Redakteure große Handy-Fotos hochladen können, müssen im Timme-Panel
unter **PHP-Einstellungen** (oder `.user.ini`) folgende Werte gesetzt sein:

| Einstellung           | Mindestwert | Warum                                  |
| --------------------- | ----------- | -------------------------------------- |
| `upload_max_filesize` | **35M**     | einzelne Bilddatei (bis 30 MB erlaubt) |
| `post_max_size`       | **40M**     | gesamter Upload inkl. Formulardaten    |
| `memory_limit`        | **256M**    | Bildverkleinerung braucht Speicher     |
| `max_execution_time`  | **120**     | Erstbefüllung und große Uploads        |

Zusätzlich sollte im Panel die PHP-Version **8.2 oder neuer** ausgewählt sein
(empfohlen: 8.5) und die Erweiterungen **pdo_mysql**, **gd** (oder **imagick**),
**mbstring**, **exif** und **fileinfo** aktiv sein. Bei Timme ist das der
Standard; im Zweifel kurz beim Support nachfragen.

## Schritt 5: Dateien hochladen

1. Im SFTP-Programm mit den Zugangsdaten von Timme verbinden.
2. In den Web-Ordner der Domain wechseln (heißt je nach Setup
   `httpdocs`, `html` oder `web`).
3. **Den gesamten Inhalt** des entpackten Ordners dorthin hochladen –
   also `index.html`, `api.php`, `datei.php`, `config.php`, `assets/`,
   `php/`, `uploads/`, `migration-data/`.

> **Wichtig:** Das dauert einige Minuten – `uploads/` enthält rund 460 Bilder
> der alten Website (ca. 170 MB). Warten Sie, bis der Upload komplett
> durchgelaufen ist, **bevor** Sie die Website zum ersten Mal aufrufen.
> Ruft man sie zu früh auf, meldet die Seite, dass noch Bilder fehlen, und
> richtet sich erst nach dem vollständigen Upload ein.

4. Danach prüfen, dass der Ordner **`uploads/`** beschreibbar ist
   (Rechte `755`, bei manchen Servern `775`). Das ist meist automatisch der Fall.

## Schritt 6: Website aufrufen – fertig

Die Domain im Browser öffnen. **Beim allerersten Aufruf** legt die Website
selbst alle Datenbanktabellen an und übernimmt sämtliche Inhalte der alten
Seite (187 Beiträge, 456 Bilder, alle Texte, Fahrzeuge). Das dauert einige
Sekunden – danach ist die Seite vollständig da.

## Schritt 7: Passwörter ändern (wichtig!)

1. Auf `https://ihre-domain.de/#/intern` gehen.
2. Mit `admin` / `FFK-Admin-2026!` anmelden.
3. Links unten auf **Passwort ändern** klicken und ein eigenes Passwort setzen.
4. Unter **Benutzer & Rechte** das Konto `redakteur` entweder löschen oder
   ihm ebenfalls ein neues Passwort geben.

---

## Wenn etwas nicht klappt

| Meldung im Browser                                    | Ursache und Lösung                                                                                                |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| „Die Datei config.php fehlt…"                         | Schritt 3 wurde übersprungen oder die Datei liegt nicht neben `index.html`.                                        |
| „Die Datenbank ist nicht erreichbar…"                 | Zugangsdaten in `config.php` prüfen (Tippfehler, falscher Datenbankname).                                          |
| Seite bleibt weiß                                     | `assets/` wurde nicht vollständig hochgeladen. Erneut hochladen.                                                    |
| „Die Bilder sind noch nicht vollständig hochgeladen…" | Der Upload von `uploads/` läuft noch oder wurde abgebrochen. Einfach fertig hochladen und die Seite erneut aufrufen. |
| Bilder fehlen auf der fertigen Seite                  | Siehe **Bilder nachträglich ergänzen** weiter unten.                                                                |
| „Der Upload ist zu groß für die Server-Einstellungen" | Schritt 4: `upload_max_filesize` und `post_max_size` erhöhen.                                                       |
| Upload bricht ohne Meldung ab                         | `memory_limit` und `max_execution_time` erhöhen (Schritt 4).                                                        |
| „Das Bild ist mit … Megapixeln zu groß…"              | `memory_limit` erhöhen (Schritt 4) – oder das Foto vorher verkleinern.                                              |
| „Auf dem Server fehlt die Bildbearbeitung…"           | Beim Hoster die PHP-Erweiterung **gd** (oder **imagick**) aktivieren lassen.                                        |
| „Das Bild konnte nicht umgewandelt werden…"           | Die Meldung nennt die technischen Gründe – bitte vollständig an den Hoster oder die Entwicklung weitergeben.         |
| „Der Ordner uploads/neu/ ist nicht beschreibbar."     | Schreibrechte für `uploads/` setzen (755 bzw. 775).                                                                 |
| „Die Datei ist zu groß für den Server."               | Schritt 4: `upload_max_filesize` und `post_max_size` erhöhen. Betrifft vor allem PDFs – Fotos verkleinert der Browser selbst. |
| „…iPhone-Format HEIC…"                                | Am iPhone unter Einstellungen → Kamera → Formate **Maximale Kompatibilität** wählen – oder die Fotos mit Safari statt Chrome hochladen. |

Technische Fehlerdetails schreibt PHP ins Fehlerprotokoll des Servers
(im Timme-Panel unter „Logfiles"). Besucher sehen davon nie etwas.
Zum Suchen eines Fehlers kann in `config.php` vorübergehend
`'app_env' => 'development'` gesetzt werden – **danach unbedingt wieder auf
`'production'` zurückstellen**.

---

## Bilder nachträglich ergänzen

Diesen Abschnitt brauchen Sie nur, wenn beim allerersten Aufruf der Website noch
nicht alle Bilder auf dem Server lagen (z. B. weil der SFTP-Upload noch lief).
Dann fehlen sie dauerhaft in Beiträgen und Mediathek: Die Erstbefüllung
verknüpft nur Bilder, die sie zu diesem Zeitpunkt vorfindet.

Neuere Fassungen brechen die Erstbefüllung in so einem Fall mit einer
Meldung ab, sodass das gar nicht mehr passieren kann. So reparieren Sie eine
bereits betroffene Installation:

1. **`uploads/` vollständig hochladen.** Den Ordner `uploads/` aus dem
   Komplett-Paket noch einmal per SFTP übertragen und dabei „Überschreiben"
   bzw. „Fehlende ergänzen" wählen. In FileZilla: alle Dateien markieren,
   hochladen, bei der Rückfrage **Überschreiben** wählen.
2. **In `config.php` das Wort `'neu'` eintragen:**

   ```php
   'auto_migrate' => 'neu',
   ```

3. **Website einmal aufrufen.** Alles, was in der Datenbank fehlt, wird
   nachgetragen – vor allem die fehlenden Einträge in der Mediathek.

Das Einlesen ist **rein ergänzend**: Es legt ausschließlich Einträge an, die
noch fehlen. Gepflegte Mitglieder, Fahrzeuge, Seitentexte, Termine, Benutzer
und selbst verfasste Beiträge bleiben unangetastet – es geht dabei nichts
verloren.

Beiträge, deren Bilder bereits beim ersten Einlesen verloren gingen, lassen
sich damit allerdings nicht mehr reparieren: Für diese fügen Sie die Bilder
im internen Bereich unter „Weitere Bilder" von Hand hinzu (siehe
**Mehrere Bilder je Beitrag und Fahrzeug** weiter unten).

Der Wert `'neu'` darf anschließend in der `config.php` stehen bleiben; die
Erstbefüllung läuft nur ein einziges Mal. Soll sie später noch einmal laufen,
tragen Sie ein anderes Wort ein (z. B. `'neu2'`).

## Update auf eine neue Version

1. Aus GitHub Actions das Artifact **`ffk-homepage-update`** herunterladen
   und entpacken (enthält nur die Programmdateien, keine Bilder).
2. Den Inhalt per SFTP in den Web-Ordner hochladen und vorhandene Dateien
   überschreiben lassen.
3. Fertig. **`config.php` und `uploads/` niemals überschreiben oder löschen** –
   dort stecken Ihre Zugangsdaten und alle Inhalte.

Nötige Datenbankänderungen führt die Website beim nächsten Aufruf selbst aus.

## Sicherung (Backup)

Zwei Dinge müssen gesichert werden:

1. **Die Datenbank** – im Timme-Panel über phpMyAdmin exportieren
   (*Exportieren → SQL → OK*) oder auf der Kommandozeile:

   ```bash
   mysqldump -u BENUTZER -p DATENBANKNAME > sicherung-$(date +%F).sql
   ```

2. **Der Ordner `uploads/`** – enthält alle Bilder und Dokumente.
   Per SFTP herunterladen oder in die Server-Backups einschließen.

Beides zusammen genügt, um die Seite jederzeit vollständig wiederherzustellen:
Dateien neu hochladen, `config.php` ausfüllen, Datenbank einspielen.

## Optional: hübsche Adressen (nur mit nginx-Zugriff)

Die Website funktioniert vollständig **ohne** jede Server-Konfiguration.
Wer bei Timme dennoch `/api/…` statt `/api.php?r=…` möchte, kann den Support
bitten, folgende Direktiven zu ergänzen:

```nginx
# /api/posts/slug/xyz  ->  /api.php?r=/posts/slug/xyz
location /api/ {
    rewrite ^/api/(.*)$ /api.php?r=/$1&$args last;
}

# /dateien/organigramm  ->  /datei.php?s=organigramm
location /dateien/ {
    rewrite ^/dateien/(.*)$ /datei.php?s=$1 last;
}
```

`api.php` erkennt beide Schreibweisen (auch `PATH_INFO`, also
`/api.php/posts/…`) und braucht dafür keine Änderung. Das Frontend ruft
weiterhin die Query-Variante auf – sie funktioniert immer.

---

# Teil 2 – Die Website bedienen

## Zugangsdaten (bitte nach dem ersten Login ändern!)

| Benutzer    | Passwort              | Rolle                                               |
| ----------- | --------------------- | --------------------------------------------------- |
| `admin`     | `FFK-Admin-2026!`     | Administrator (alle Rechte, Benutzerverwaltung)     |
| `redakteur` | `FFK-Redakteur-2026!` | Beispiel-Redakteur (Einsätze, Neuigkeiten, Termine) |

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
Nach 20 Fehlversuchen innerhalb von 15 Minuten sperrt der Server die Anmeldung
für die betreffende IP-Adresse vorübergehend.

## Inhalte pflegen

- **Startseite (Hero):** Unter „Startseite" werden das große Bild oben, Überschrift,
  Einleitungstext und Alternativtext gepflegt (Berechtigung „Seiten & Texte").
  Bildquelle wahlweise **Automatisch** (Standard: Titelbild des neuesten Einsatzberichts
  mit Bild; ohne Beitragsbild erscheint das Ersatzbild) oder **Eigenes Bild**
  (z. B. die Grafik mit Wappen + First-Responder-Logo, `uploads/hero-standard.png`).
  Zusätzlich einstellbar: Darstellung (füllend für Fotos / eingepasst für Logos) und
  Stärke der Abdunkelung. Ein Wort der Überschrift zwischen zwei Sternchen (`*Minute*`)
  wird rot hervorgehoben. „Standard wiederherstellen" setzt alle Werte zurück.
- **Beiträge & Einsätze:** Titel, Kategorie, Einsatzstichwort/-ort, Datum, Titelbild, Text mit
  Bild-Upload direkt im Editor. Entwürfe möglich. Beiträge erscheinen automatisch auf
  Startseite, in „Aktuelles", „Einsätze" und im Jahres-Archiv.
- **Titelbild:** Es steht in der Übersicht auf der Kachel und auf der
  Beitragsseite groß über dem Text. Ein Klick zeigt es bildschirmfüllend.
  Ist dasselbe Bild zusätzlich unter „Weitere Bilder" eingetragen, erscheint es
  trotzdem nur einmal.
- **Mehrere Bilder je Beitrag und Fahrzeug:** Unter dem Titelbild gibt es den
  Bereich **Weitere Bilder**. Dort lassen sich beliebig viele Fotos hinzufügen – neu
  hochladen oder mit **Aus Mediathek** aus den bereits vorhandenen Bildern
  auswählen (auch aus den rund 460 von der alten Website übernommenen).
  Die Reihenfolge ändern die Pfeile auf den Vorschaubildern. Besucher sehen
  die Bilder als Reihe unter dem Text; ein Klick zeigt sie groß, geblättert
  wird mit den Pfeilen oder der Tastatur. Bei **Fahrzeugen** gibt es denselben
  Bereich – die Bilder erscheinen dort unter der Beschreibung im Gerätehaus.
- **Bereits hochgeladene Bilder verknüpfen:** Der Knopf **Aus Mediathek**
  steht überall dort, wo ein Bild ausgewählt wird – beim Titelbild, in der
  Galerie sowie bei Fahrzeugen, Mitgliedern und dem Startseiten-Bild. Ein
  Suchfeld hilft beim Finden; neue Bilder lassen sich im selben Fenster
  hochladen.
- **Termine:** Datum, Uhrzeit, Ort, Art (Übung/Veranstaltung).
- **Standort mit Karte (optional):** Beiträge/Einsätze und Termine können einen
  Kartenstandort bekommen – per Adresssuche oder direkt per Klick auf die Karte
  (praktisch für Einsätze abseits von Adressen, z. B. an einer Wegkreuzung).
  Besucher sehen dann beim Eintrag eine OpenStreetMap-Karte, die aus
  Datenschutzgründen erst nach Klick auf „Karte anzeigen" geladen wird
  (2-Klick-Lösung), plus einen Link „In Google Maps öffnen" zur Navigation.
  Die Datenschutzerklärung enthält den passenden Abschnitt dazu.
- **Fahrzeuge:** Name, Typ, Titelbild, weitere Bilder, Beschreibung, Sortierung.
- **Mitglieder:** Name, Funktion, Gruppe (Vorstandschaft/Aktive), optionales Foto.
  Die **Reihenfolge** wird je Gruppe festgelegt: am Computer den Eintrag am
  Griff links anfassen und an die gewünschte Stelle ziehen, auf Handy und
  Tablet die Pfeile hoch/runter benutzen. Genau in dieser Reihenfolge
  erscheinen die Personen auf der Seite „Über uns". Neue Einträge landen
  zunächst am Ende ihrer Gruppe.
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
  (`/datei.php?s=<kürzel>`), den der Knopf „Link kopieren" in die Zwischenablage legt.
  Er kann über das Link-Symbol im Texteditor in Beiträge oder Seiten eingefügt werden.
  Wird die Datei später über „Austauschen" ersetzt, bleibt der Link unverändert
  gültig – es muss nichts neu verlinkt werden. Ältere Links in der Form
  `/dateien/<kürzel>` funktionieren weiterhin.

### Automatische Bild-Optimierung

Alle hochgeladenen Bilder (Mediathek, Titelbilder, Fotos im Editor – auch große
Handy-Fotos bis 30 MB) werden beim Upload automatisch fürs Web aufbereitet:

- Verkleinerung auf maximal 1600 px Kantenlänge
- Neukodierung als platzsparendes WebP (aus ~10 MB Handy-Foto wird typischerweise < 1 MB)
- Übernahme der EXIF-Drehung (Hochformat-Fotos stehen richtig)
- Entfernung aller Metadaten – **inklusive GPS-Standort** vom Handy (Datenschutz)

Die Verarbeitung probiert der Reihe nach jede vorhandene Bibliothek
(**Imagick**, **GD**) und jedes mögliche Ausgabeformat durch: WebP, sonst JPEG,
bei durchsichtigen Bildern PNG. Scheitert eine Bibliothek – manche Hoster
schränken Imagick per `policy.xml` ein oder übersetzen GD ohne WebP –, wird
automatisch die nächste genommen. Verkleinert und von Metadaten befreit wird in
jedem Fall. Klappt gar nichts, nennt die Meldung die konkreten Gründe und was
der Server kann; dieser Text lässt sich direkt an den Hoster weitergeben.
Redakteure müssen nichts beachten und können Fotos direkt vom Handy hochladen.
Nur animierte GIFs bleiben unverändert.

Fotos über 1 MB verkleinert schon der Browser, bevor er sie losschickt – auf
dieselben 1600 px, die der Server ohnehin herstellt. Das hat zwei Gründe: Ein
15-MB-Foto vom Handy überschreitet auf manchen Servern die zulässige
Anfragegröße und würde ohne verständliche Meldung abgewiesen; und über
Mobilfunk dauert das Hochladen sonst unnötig lange. Kann der Browser das Bild
nicht öffnen, schickt er die Originaldatei – dann übernimmt wie bisher der
Server.

### iPhone-Fotos (Format HEIC)

Neuere iPhones speichern Fotos standardmäßig als **HEIC**. PHP kann dieses
Format nicht lesen. Wie sich das auswirkt, hängt am Browser:

- **Safari** wandelt das Foto beim Auswählen selbst in JPG um. Hochladen
  funktioniert ohne weiteres Zutun.
- **Chrome am iPhone** reicht die HEIC-Datei durch – oft sogar unter dem Namen
  `image.jpg`, obwohl HEIC darin steht. Die Seite erkennt das am Inhalt der
  Datei und bricht sofort mit einer Meldung ab, statt minutenlang Daten zu
  schicken, die der Server nicht verwerten kann.

Dauerhaft lösen lässt sich das am Gerät: **Einstellungen → Kamera → Formate →
Maximale Kompatibilität**. Dann nimmt das iPhone JPG-Fotos auf, und jeder
Browser funktioniert. Wer nichts umstellen möchte, lädt die Fotos mit Safari
hoch.

## Besucherstatistik

Die Übersichtsseite des internen Bereichs zeigt eine **anonyme, cookielose
Besucherstatistik**: Seitenaufrufe und Besucher pro Tag (Diagramm, wählbar 7/30/90
Tage), Aufrufe heute, meistbesuchte Seiten und externe Herkunft (z. B. Google).

- Komplett eingebaut, kein Fremdanbieter, kein Cookie-Banner nötig: Besucher werden
  pro Tag über eine Prüfsumme aus IP + Browser-Kennung + täglich wechselndem
  Zufallswert erkannt; gespeichert werden nur Tagessummen, keine IP-Adressen.
- Suchmaschinen-Bots, der interne Bereich und **angemeldete Redakteure** (im selben
  Browser) werden nicht mitgezählt.
- Tagesgrenzen richten sich nach der deutschen Zeitzone (Europe/Berlin).
- Die Datenschutzerklärung enthält den passenden Abschnitt („Anonyme
  Besucherstatistik").

## Migrierte Inhalte

Von der alten Website (ff-kirchberg.de, WordPress) wurden vollständig übernommen:

- 187 Beiträge inkl. Bilder und Kategorien (Einsätze, First Responder, Veranstaltungen, Pressemeldungen, Allgemein)
- 456 Mediendateien (inkl. Satzung und Beitrittserklärung als PDF)
- Über uns, Chronik, Historische Brände, Impressum, Datenschutz, Links
- Fahrzeuge LF 10/6, TSF 8, MZF inkl. Beschreibungen und Fotos

---

# Teil 3 – Für Entwickler

## Aufbau des Web-Ordners

```
index.html, assets/     fertiges Frontend (Vite-Build), rein statisch
api.php                 Front-Controller für alle API-Endpunkte
datei.php               Auslieferung der Downloads über den stabilen Link
php/                    Programmcode des Backends (kein direkter Aufruf nötig)
uploads/                Bilder und Dokumente (liefert der Webserver direkt aus)
migration-data/         WordPress-Export für die einmalige Erstbefüllung
config.php              Zugangsdaten – NICHT im Repository
```

## Adressschema

| Früher (Express)   | Jetzt (PHP)               |
| ------------------ | ------------------------- |
| `/api/posts`       | `/api.php?r=/posts`       |
| `/api/posts?limit=3` | `/api.php?r=/posts&limit=3` |
| `/dateien/<slug>`  | `/datei.php?s=<slug>`     |
| `/uploads/…`       | unverändert               |

Die Umrechnung passiert an genau einer Stelle im Frontend:
`apiUrl()` / `fileUrl()` / `apiFetch()` in `client/src/lib/auth.tsx`.
Alle übrigen Client-Dateien arbeiten unverändert mit den `/api/…`-Pfaden.

`PATCH`, `PUT` und `DELETE` werden als `POST` mit `_method`-Angabe gesendet:
PHP wertet Formulardaten (Datei-Uploads) nur bei `POST` aus, und manche
Managed-Hosting-Konfigurationen lassen diese Methoden gar nicht durch.
`api.php` stellt die ursprüngliche Methode wieder her; echte `PATCH`/`PUT`/
`DELETE`-Anfragen mit JSON funktionieren ebenfalls.

## Entwickeln

```bash
npm install
php -S 127.0.0.1:8000 -t .     # Backend (nutzt config.php im Projektordner)
npm run dev                     # Frontend mit Hot Reload, Proxy auf Port 8000
```

Für einen vollständigen Test gegen das echte Paket:

```bash
npm run build:dir               # -> dist/deploy
cp config.php dist/deploy/      # Zugangsdaten der Testdatenbank
php -S 127.0.0.1:8080 -t dist/deploy
node tests/e2e.mjs              # End-to-End-Test (braucht Playwright)
```

Prüfungen vor dem Commit:

```bash
npm run check                                  # TypeScript
php tests/bilder.php                           # Bildverarbeitung dieses Servers
find . -name "*.php" -not -path "./node_modules/*" -print0 | xargs -0 -n1 php -l
```

`php tests/bilder.php` zeigt oben, was der Server kann (`webp`, `jpeg`, `png`),
und prüft alle Ausgabeformate durch – hilfreich, wenn Uploads auf einem
bestimmten Server nicht funktionieren.

## Deployment-Paket bauen

```bash
npm run build       # -> dist/deploy/ + dist/ffk-homepage-{komplett,update}.zip
```

Denselben Schritt führt der GitHub-Actions-Workflow
`.github/workflows/build-deploy-zip.yml` bei jedem Push auf `main` aus.

## Datenbank

Das Schema legt `php/db.php` beim ersten Aufruf selbst an
(`CREATE TABLE IF NOT EXISTS` plus Nachrüsten fehlender Spalten). Die hinterlegte
`schema_version` in der Tabelle `settings` sorgt dafür, dass spätere Anfragen
diesen Schritt überspringen. Ein SQL-Import ist nie nötig.

Tabellen: `users`, `auth_tokens`, `categories`, `posts`, `events`, `vehicles`,
`members`, `pages`, `settings`, `media`, `documents`, `stats_days`, `stats_pages`,
`stats_referrers`, `stats_seen` sowie `login_attempts` (Rate-Limit der Anmeldung,
ersetzt das frühere `express-rate-limit` prozessunabhängig).

Die Spaltennamen sind wie bisher `snake_case`; `php/storage.php` bildet sie auf
die `camelCase`-Felder der API ab, damit sich am JSON nichts geändert hat.

## Die alte Node.js-Fassung

Der komplette Stand vor dem Umbau (Express, SQLite, Docker, Render,
Docker-Image-Workflow) liegt im Branch **`nodejs-express-version`**.

## Wichtige Hinweise

- **Sitzungen:** Die Anmeldung bleibt im Browser gespeichert und überlebt auch ein
  Neuladen der Seite. Sie läuft nach 30 Tagen automatisch ab, danach ist eine erneute
  Anmeldung nötig. „Abmelden" beendet die Sitzung sofort.
- **Passwörter:** gespeichert mit `password_hash()`. Die scrypt-Hashes der alten
  Node-Fassung sind nicht übertragbar – die Erstbefüllung legt die Benutzer neu an.
- **Aktive/Vorstandschaft:** Nur Beispieldaten – echte Namen bitte im internen Bereich pflegen.
- **Termine:** Beispieltermine eingetragen – bitte anpassen.
- **Impressum/Datenschutz:** Bitte auf Aktualität prüfen (insbesondere
  Anschrift/Verantwortliche).
- **Schriftarten:** Die Schriften (Clash Display, Satoshi) werden lokal vom
  eigenen Server ausgeliefert. Die Dateien liegen unter `client/src/fonts/` und
  landen beim Build fertig im `assets/`-Ordner; beim Seitenaufruf wird kein
  externer Dienst mehr kontaktiert (datenschutzfreundlich, keine Übertragung von
  Besucherdaten an Dritte).
