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

    // Automatische Erstbefüllung der Datenbank aus migration-data/ beim ersten
    // Aufruf. Nach der Ersteinrichtung kann das ruhig aktiviert bleiben – es
    // passiert nur etwas, solange noch kein einziger Benutzer existiert.
    'auto_migrate' => true,
];
