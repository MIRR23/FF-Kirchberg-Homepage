<?php
/**
 * Konfiguration der Website – Vorlage.
 *
 * ANLEITUNG
 * 1. Diese Datei in "config.php" umbenennen (bzw. kopieren).
 * 2. Die vier Datenbank-Angaben unten eintragen (stehen im Kundenpanel des
 *    Hosters, wenn dort eine MariaDB-/MySQL-Datenbank angelegt wurde).
 * 3. Speichern und in den Web-Ordner hochladen – fertig. Beim ersten Aufruf
 *    der Seite legt die Anwendung alle Tabellen selbst an und befüllt sie.
 *
 * WICHTIG: config.php enthält das Datenbank-Passwort und gehört deshalb
 * NICHT ins Git-Repository. Sie wird nur auf dem Server hinterlegt.
 */

return [
    // ----- Datenbank (MariaDB/MySQL) -----
    'db_host' => 'localhost',
    'db_port' => 3306,
    'db_name' => 'DATENBANKNAME',
    'db_user' => 'BENUTZERNAME',
    'db_pass' => 'PASSWORT',

    // Optional: abweichender Socket-Pfad statt Host/Port (leer lassen = aus).
    'db_socket' => '',

    // ----- Umgebung -----
    // 'production' = keine technischen Fehlerdetails an Besucher (empfohlen).
    // 'development' = ausführliche Fehlermeldungen, nur zum Testen verwenden.
    'app_env' => 'production',

    // Nur auf true setzen, wenn die Seite HINTER einem eigenen Proxy/Loadbalancer
    // läuft, der die echte Besucher-IP im Header X-Forwarded-For weiterreicht.
    // Beim gewöhnlichen Timme-Hosting bitte auf false lassen: dort spricht der
    // Browser direkt mit dem Server, und ein frei setzbarer Header dürfte weder
    // das Anmelde-Limit noch die Besucherzählung beeinflussen.
    'trust_forwarded_for' => false,

    // Automatische Erstbefüllung der Datenbank aus migration-data/ beim ersten
    // Aufruf. Nach der Ersteinrichtung kann das ruhig aktiviert bleiben – es
    // passiert nur etwas, solange noch kein einziger Benutzer existiert.
    //
    // FEHLENDE INHALTE NACHTRAGEN: hier statt true das Wort 'neu' eintragen
    // und die Website einmal aufrufen. Die Befüllung ergänzt dann alles, was
    // in der Datenbank fehlt. Sie ist rein ergänzend und überschreibt nichts –
    // gepflegte Mitglieder, Fahrzeuge, Seiten, Termine, Benutzer und eigene
    // Beiträge bleiben unangetastet. Der Wert darf anschließend stehen
    // bleiben; erst ein anderes Wort ('neu2', 'neu3' …) trägt erneut nach.
    'auto_migrate' => true,

    // Normalerweise bricht die Erstbefüllung ab, solange in uploads/ noch
    // Bilder fehlen – sonst wären sie danach dauerhaft aus den Beiträgen
    // verschwunden. Nur auf true setzen, wenn einzelne Bilder bewusst fehlen
    // und die Einrichtung trotzdem laufen soll.
    'allow_incomplete_media' => false,
];
