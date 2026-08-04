<?php
/**
 * Feste Standard-Inhalte für Seiten, die nicht (mehr) aus der alten
 * WordPress-Website übernommen werden. Die Texte sind im internen Bereich
 * unter „Seiten & Texte" jederzeit anpassbar.
 *
 * Hinweis Impressum/Datenschutz: Die Texte orientieren sich am Rechtsstand
 * 2026 (DDG statt TMG, MStV, DSGVO, TDDDG, Wegfall der EU-ODR-Plattform),
 * ersetzen aber keine Rechtsberatung im Einzelfall.
 *
 * ACHTUNG: Diese Datei wurde 1:1 aus der bisherigen server/content.ts
 * übernommen. Änderungen bitte hier pflegen.
 */

declare(strict_types=1);

defined('FFK_APP') || exit;

const FFK_IMPRESSUM_HTML = <<<'HTML'
<h3>Angaben gemäß § 5 Digitale-Dienste-Gesetz (DDG)</h3>
<p>Freiwillige Feuerwehr Kirchberg<br />
Baustarring 4<br />
84434 Kirchberg</p>
<p><strong>Vertreten durch:</strong></p>
<p><strong>1. Vorstand</strong><br />
Thomas Huber<br />
Baustarring 4<br />
84434 Kirchberg<br />
E-Mail: <a title="Nachricht an den Vorstand" href="mailto:vorstand@ff-kirchberg.de">vorstand@ff-kirchberg.de</a></p>
<p><strong>1. Kommandant</strong><br />
Martin Grandinger<br />
Froschbach 1<br />
84434 Kirchberg<br />
E-Mail: <a title="Nachricht an den Kommandanten" href="mailto:kommandant@ff-kirchberg.de">kommandant@ff-kirchberg.de</a></p>
<h3>Kontakt</h3>
<p>E-Mail: <a href="mailto:webmaster@ff-kirchberg.de">webmaster@ff-kirchberg.de</a></p>
<h3>Verantwortlich für den Inhalt nach § 18 Abs. 2 Medienstaatsvertrag (MStV)</h3>
<p>Thomas Huber<br />
Baustarring 4<br />
84434 Kirchberg</p>
<h3>Verbraucherstreitbeilegung</h3>
<p>Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer
Verbraucherschlichtungsstelle teilzunehmen.</p>
<h3>Haftung für Inhalte</h3>
<p>Die Inhalte dieser Website wurden mit größter Sorgfalt erstellt. Für die Richtigkeit,
Vollständigkeit und Aktualität der Inhalte können wir jedoch keine Gewähr übernehmen.
Als Diensteanbieter sind wir gemäß § 7 Abs. 1 DDG für eigene Inhalte auf diesen Seiten
nach den allgemeinen Gesetzen verantwortlich. Nach §§ 8 bis 10 DDG sind wir als
Diensteanbieter jedoch nicht verpflichtet, übermittelte oder gespeicherte fremde
Informationen zu überwachen oder nach Umständen zu forschen, die auf eine rechtswidrige
Tätigkeit hinweisen. Verpflichtungen zur Entfernung oder Sperrung der Nutzung von
Informationen nach den allgemeinen Gesetzen bleiben hiervon unberührt. Eine
diesbezügliche Haftung ist erst ab dem Zeitpunkt der Kenntnis einer konkreten
Rechtsverletzung möglich. Bei Bekanntwerden von entsprechenden Rechtsverletzungen
werden wir diese Inhalte umgehend entfernen.</p>
<h3>Haftung für Links</h3>
<p>Unser Angebot enthält Links zu externen Websites Dritter, auf deren Inhalte wir
keinen Einfluss haben. Deshalb können wir für diese fremden Inhalte auch keine Gewähr
übernehmen. Für die Inhalte der verlinkten Seiten ist stets der jeweilige Anbieter oder
Betreiber der Seiten verantwortlich. Die verlinkten Seiten wurden zum Zeitpunkt der
Verlinkung auf mögliche Rechtsverstöße überprüft; rechtswidrige Inhalte waren zum
Zeitpunkt der Verlinkung nicht erkennbar. Bei Bekanntwerden von Rechtsverletzungen
werden wir derartige Links umgehend entfernen.</p>
<h3>Urheberrecht</h3>
<p>Die durch die Seitenbetreiber erstellten Inhalte und Werke auf diesen Seiten
unterliegen dem deutschen Urheberrecht. Die Vervielfältigung, Bearbeitung, Verbreitung
und jede Art der Verwertung außerhalb der Grenzen des Urheberrechtes bedürfen der
schriftlichen Zustimmung des jeweiligen Autors bzw. Erstellers. Soweit die Inhalte auf
dieser Seite nicht vom Betreiber erstellt wurden, werden die Urheberrechte Dritter
beachtet. Sollten Sie trotzdem auf eine Urheberrechtsverletzung aufmerksam werden,
bitten wir um einen entsprechenden Hinweis.</p>
HTML;

const FFK_DATENSCHUTZ_HTML = <<<'HTML'
<h3>1. Verantwortlicher</h3>
<p>Verantwortlicher im Sinne der Datenschutz-Grundverordnung (DSGVO) ist:</p>
<p>Freiwillige Feuerwehr Kirchberg<br />
vertreten durch den 1. Vorstand Thomas Huber<br />
Baustarring 4<br />
84434 Kirchberg<br />
E-Mail: <a href="mailto:vorstand@ff-kirchberg.de">vorstand@ff-kirchberg.de</a></p>
<h3>2. Allgemeines zur Datenverarbeitung</h3>
<p>Der Schutz Ihrer persönlichen Daten ist uns wichtig. Wir verarbeiten personenbezogene
Daten nur, soweit dies für die Bereitstellung einer funktionsfähigen Website sowie
unserer Inhalte erforderlich ist. Diese Website verwendet <strong>keine Cookies zu
Analyse- oder Werbezwecken</strong> und bindet keine externen Tracking-Dienste ein.
Zur Reichweitenmessung wird ausschließlich eine anonyme, cookielose Zählung auf
unserem eigenen Server erstellt (siehe Abschnitt 4).</p>
<h3>3. Bereitstellung der Website und Server-Logfiles</h3>
<p>Beim Aufruf dieser Website werden durch den Hosting-Anbieter automatisch Informationen
in sogenannten Server-Logfiles gespeichert, die Ihr Browser übermittelt. Dies sind:
IP-Adresse, Datum und Uhrzeit der Anfrage, aufgerufene Seite, verwendeter Browser und
Betriebssystem. Diese Daten sind nicht bestimmten Personen zuordenbar und werden nicht
mit anderen Datenquellen zusammengeführt. Die Verarbeitung erfolgt auf Grundlage von
Art. 6 Abs. 1 lit. f DSGVO aus unserem berechtigten Interesse an der technisch
fehlerfreien und sicheren Bereitstellung der Website. Die Logdaten werden nach kurzer
Zeit automatisch gelöscht.</p>
<h3>4. Anonyme Besucherstatistik (ohne Cookies)</h3>
<p>Um zu erfahren, wie viele Personen unsere Website besuchen und welche Inhalte
interessieren, zählen wir Seitenaufrufe auf unserem eigenen Server – ohne Cookies,
ohne Fremdanbieter und ohne Bildung von Nutzungsprofilen. Zur Erkennung, ob ein
Aufruf am selben Tag vom selben Besucher stammt, wird aus IP-Adresse und
Browser-Kennung zusammen mit einem <strong>täglich wechselnden Zufallswert</strong> eine
anonyme Prüfsumme gebildet; die IP-Adresse selbst wird dabei nicht gespeichert.
Nach dem Tageswechsel ist keine Zuordnung mehr möglich, gespeichert bleiben
ausschließlich anonyme Tagessummen (Aufrufe, Besucherzahl, aufgerufene Seiten,
verweisende Websites). Ein Personenbezug ist damit ausgeschlossen; soweit
überhaupt personenbezogene Daten kurzzeitig verarbeitet werden, erfolgt dies auf
Grundlage unseres berechtigten Interesses an einer datensparsamen
Reichweitenmessung (Art. 6 Abs. 1 lit. f DSGVO). Auf Endgeräte wird dabei nicht
zugegriffen und nichts gespeichert (§ 25 TDDDG findet keine Anwendung).</p>
<h3>5. Kontaktaufnahme per E-Mail</h3>
<p>Wenn Sie uns per E-Mail kontaktieren, werden Ihre Angaben (E-Mail-Adresse, Name,
Inhalt der Nachricht) zum Zweck der Bearbeitung der Anfrage und für den Fall von
Anschlussfragen bei uns gespeichert. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO
(berechtigtes Interesse an der Beantwortung Ihrer Anfrage) bzw. Art. 6 Abs. 1 lit. b
DSGVO, sofern die Anfrage auf den Abschluss eines Vertrags abzielt. Diese Daten geben
wir nicht ohne Ihre Einwilligung weiter und löschen sie, sobald sie für die Bearbeitung
nicht mehr erforderlich sind.</p>
<h3>6. Fotos von Einsätzen und Veranstaltungen</h3>
<p>Zur Öffentlichkeitsarbeit veröffentlichen wir auf dieser Website Berichte und Fotos
von Einsätzen, Übungen und Veranstaltungen der Feuerwehr. Rechtsgrundlage ist unser
berechtigtes Interesse an der Darstellung unserer Arbeit (Art. 6 Abs. 1 lit. f DSGVO).
Dabei achten wir darauf, die Interessen abgebildeter Personen zu wahren; Aufnahmen von
Verletzten oder anderen schutzwürdigen Personen werden nicht veröffentlicht. Sollten
Sie auf einem Foto abgebildet sein und mit der Veröffentlichung nicht einverstanden
sein, genügt eine kurze Nachricht an uns – wir entfernen das Bild dann zeitnah.</p>
<h3>7. Eingebettete Videos (YouTube/Vimeo)</h3>
<p>In einzelnen Beiträgen können Videos der Anbieter YouTube (Google Ireland Ltd.) oder
Vimeo (Vimeo Inc.) eingebettet sein. Erst wenn Sie ein solches Video abspielen, werden
Daten (u. a. Ihre IP-Adresse) an den jeweiligen Anbieter übertragen; dabei können auch
Daten in die USA übermittelt werden. Näheres entnehmen Sie den Datenschutzhinweisen der
Anbieter: <a href="https://policies.google.com/privacy">Google/YouTube</a>,
<a href="https://vimeo.com/privacy">Vimeo</a>.</p>
<h3>8. Kartendarstellung (OpenStreetMap)</h3>
<p>Bei Einsatzberichten und Terminen kann ein Standort auf einer Karte angezeigt werden.
Die Karte wird aus Datenschutzgründen <strong>erst nach einem Klick</strong> auf
„Karte anzeigen" geladen (2-Klick-Lösung). Erst dann werden Kartenausschnitte vom
Server der OpenStreetMap Foundation (St John's Innovation Centre, Cambridge,
Großbritannien) abgerufen und dabei Ihre IP-Adresse dorthin übertragen. Für
Großbritannien besteht ein Angemessenheitsbeschluss der EU-Kommission.
Rechtsgrundlage ist Ihre Einwilligung durch den Klick (Art. 6 Abs. 1 lit. a DSGVO,
§ 25 Abs. 1 TDDDG). Näheres:
<a href="https://osmfoundation.org/wiki/Privacy_Policy">Datenschutzerklärung der OSM Foundation</a>.
Der zusätzlich angebotene Link „In Google Maps öffnen" führt erst nach dem Anklicken
zu Google; dabei gelten die Datenschutzhinweise von Google.</p>
<h3>9. Interner Bereich (nur für Mitglieder/Redakteure)</h3>
<p>Für die Pflege der Website existiert ein zugangsgeschützter interner Bereich. Bei der
Anmeldung wird ein Anmelde-Token im lokalen Speicher (localStorage) des Browsers
abgelegt. Dies ist für die Bereitstellung dieser ausdrücklich gewünschten Funktion
technisch erforderlich (§ 25 Abs. 2 Nr. 2 TDDDG) und betrifft ausschließlich angemeldete
Redakteure, nicht die Besucher der Website.</p>
<h3>10. Ihre Rechte</h3>
<p>Sie haben gegenüber uns folgende Rechte hinsichtlich der Sie betreffenden
personenbezogenen Daten: Recht auf Auskunft (Art. 15 DSGVO), Berichtigung (Art. 16
DSGVO), Löschung (Art. 17 DSGVO), Einschränkung der Verarbeitung (Art. 18 DSGVO),
Datenübertragbarkeit (Art. 20 DSGVO) sowie Widerspruch gegen die Verarbeitung (Art. 21
DSGVO). Eine erteilte Einwilligung können Sie jederzeit mit Wirkung für die Zukunft
widerrufen.</p>
<h3>11. Beschwerderecht bei der Aufsichtsbehörde</h3>
<p>Sie haben zudem das Recht, sich bei einer Datenschutz-Aufsichtsbehörde über die
Verarbeitung Ihrer personenbezogenen Daten zu beschweren. Zuständig für uns ist das
Bayerische Landesamt für Datenschutzaufsicht (BayLDA), Promenade 18, 91522 Ansbach,
<a href="https://www.lda.bayern.de">www.lda.bayern.de</a>.</p>
<p><em>Stand: August 2026</em></p>
HTML;

const FFK_FIRST_RESPONDER_HTML = <<<'HTML'
<p>Die <strong>First Responder</strong> (auch „Helfer vor Ort") der Freiwilligen Feuerwehr
Kirchberg sind speziell ausgebildete Einsatzkräfte, die bei medizinischen Notfällen in
Kirchberg und Umgebung alarmiert werden – <strong>zusätzlich</strong> zum regulären
Rettungsdienst, niemals als dessen Ersatz.</p>
<h3>Warum First Responder?</h3>
<p>Bei einem Herz-Kreislauf-Stillstand zählt jede Minute: Mit jeder Minute ohne Hilfe
sinkt die Überlebenswahrscheinlichkeit deutlich. Da der Rettungswagen im ländlichen
Raum eine gewisse Anfahrtszeit benötigt, überbrücken unsere First Responder das
sogenannte <em>therapiefreie Intervall</em> – die Zeit zwischen Notruf und Eintreffen
des Rettungsdienstes. Weil wir aus dem Ort kommen, sind wir oft schon nach wenigen
Minuten beim Patienten.</p>
<h3>Wie läuft ein Einsatz ab?</h3>
<ul>
<li>Beim Notruf 112 alarmiert die Integrierte Leitstelle Erding bei entsprechenden
Notfällen im Gemeindegebiet automatisch unsere First Responder – parallel zu
Rettungswagen und ggf. Notarzt.</li>
<li>Die First Responder leisten qualifizierte Erste Hilfe: Kontrolle der
Vitalfunktionen, Wiederbelebung, Einsatz des Defibrillators (AED),
Sauerstoffgabe, Betreuung von Patienten und Angehörigen.</li>
<li>Nach Eintreffen des Rettungsdienstes übergeben sie den Patienten und
unterstützen bei Bedarf weiter.</li>
</ul>
<h3>Ausbildung und Ausstattung</h3>
<p>Unsere First Responder sind mindestens als Ersthelfer mit erweiterter
Sanitätsausbildung qualifiziert und bilden sich regelmäßig fort. Zur Ausstattung
gehören unter anderem ein Notfallrucksack, ein automatisierter externer Defibrillator
(AED) und Sauerstoff.</p>
<h3>Wichtig</h3>
<p>Die First Responder ersetzen <strong>nicht</strong> den Notruf: Wählen Sie bei einem
Notfall immer die <strong>112</strong>. Die Leitstelle entscheidet über die Alarmierung
aller erforderlichen Kräfte.</p>
HTML;
