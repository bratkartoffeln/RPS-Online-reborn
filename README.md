# RPS Arena – Version 0.4.7

Ein eigenständiges Browser-Remake des taktischen Stein-Papier-Schere-Prinzips:
zwei Spieler, verdeckte Figuren, eine Flagge und eine Falle pro Seite. Der
Spielserver läuft lokal, im LAN und als Container auf dem QNAP. Version 0.4.7
enthält gemeinsame Spielserien mit Punktestand und das vollständig vektorisierte
Grafikset „ICQ Retro“. Figuren, Spielfeld, Logo, Schiedsrichter und einzelne
Waffen stammen jetzt aus einer gemeinsamen SVG-Map. Beide Teams haben Vorder-
und Rückenansichten sowie eigene Aufdeckposen. Der Raumersteller bleibt blau,
der zweite Spieler rot; die eigene Armee steht in beiden Browsern unten.
Der größere Schiedsrichter zeigt die feste Farbe des Zugspielers beziehungsweise
Siegers und weist je Browser auf dessen Spielfeldseite: eigene Seite unten,
gegnerische Seite oben. Beide Retro-Fallen sind wieder goldgelb.
Die Zielflaggen sind getauscht: bei der blauen Mannschaft rot, bei der roten blau.
Die Waffenwahl erscheint mittig über dem Spielfeld. Kampfanimationen zeigen
den Zusammenstoß und den Sieger; anschließend hüpft dessen Mannschaft.
Bei einer Flaggeneroberung zeigt ICQ Retro einen lächelnden Fahnenträger in
Vorderansicht, und die Gewinnerarmee springt viermal gemeinsam. Unter dem
Spielfeld können sich die beiden Teilnehmer im Raumchat austauschen.

## Neu in Version 0.4.7

- **Raumchat unter dem Spielfeld:** Nachrichten mit bis zu 300 Unicode-Zeichen
  per Enter oder **Senden** abschicken. Spielernamen behalten ihre feste blaue
  beziehungsweise rote Farbe. Der Raum behält die letzten 50 Nachrichten über
  weitere Partien, Serien und Wiederverbindungen hinweg im Arbeitsspeicher.
- **Entwürfe und Wiederverbindung:** Bei Sendefehlern bleibt die Eingabe erhalten.
  Erneut übertragene, bereits bestätigte Nachrichten werden nicht doppelt
  eingefügt. Der Chat ist vom Spielstand und den geheimen Duellwahlen getrennt.
- **Eigene Retro-Posen für Flaggensieger:** Nur bei einer tatsächlichen
  Flaggeneroberung erscheint der erfolgreiche Kämpfer lächelnd mit erhobener
  eroberter Flagge. Beide Browser zeigen ihn von vorn. Wegen der bereits
  getauschten Zielflaggen hält der blaue Sieger ein blaues Tuch, der rote ein rotes.
- **Vier gemeinsame Sprünge beim Flaggensieg:** Der Fahnenträger jubelt mit der
  gesamten verbliebenen Gewinnerarmee und bleibt anschließend in seiner Pose
  auf dem Zielfeld stehen. Ohne Animationen oder bei reduzierter Bewegung
  erscheint die Pose statisch. Normale Kampf- und Aufgabensiege behalten ihren
  bisherigen kurzen Jubel.
- **Mehr Zeit für den Kampf:** Die vier Phasen dauern nominell 600, 600, 700 und
  1100 Millisekunden, zusammen 3 Sekunden. Zwischen bestätigter Waffenwahl und
  Kampf liegen 600 Millisekunden. Ohne Bewegung bleibt das Ergebnis 350
  Millisekunden statisch sichtbar.
- **Leicht transparente gemeinsame Fläche:** Klassisch und Arcade verwenden
  85 Prozent Deckkraft für den Overlaygrund, ICQ Retro weiterhin 92 Prozent.
  Waffen, Texte und Bedienelemente bleiben vollständig deckend.
- **43 gemeinsame Atlasmotive:** Zwei native SVG-Frontposen erweitern den
  Retro-Atlas auf **2016 × 2016**. Die bisherigen 41 Ausschnittpositionen bleiben
  erhalten; die PNG wird aus derselben SVG neu exportiert. Eigene Sets können
  die optionalen Siegerbilder mit `flagVictoryFrames.blue/red` zuordnen.

## Neu in Version 0.4.6

- **Ein gemeinsamer Overlayhintergrund:** Waffenwahl und Gefecht liegen jeweils
  auf einer zusammenhängenden, leicht transparenten Fläche. Im ICQ-Retro-Design
  ist sie helloliv. Überschrift, Waffen, Spielernamen und Status werden dadurch
  ruhig zusammengefasst; das Brett bleibt um das Panel herum sichtbar.
- **Waffen und Texte bleiben deckend:** Nur die Hintergrundfarbe ist transparent.
  Auch nach bestätigter Waffenwahl bleiben alle Symbole und Beschriftungen klar
  sichtbar. Auswahl, Häkchen und Tastaturfokus kennzeichnen den Zustand.
- **Für schmale Spielfelder angepasst:** Kleinere Innenabstände erhalten Platz
  für die großen Waffenbilder. Die Kampffolge und der Mannschaftsjubel bleiben
  erhalten; die statische Verliererwaffe wird mit Graustufen und Text markiert.

## Seit Version 0.4.5

- **Waffenwahl über dem Spielfeld:** Bei gleichen Waffen öffnet sich mittig
  das Overlay „Wähle deine Waffe“ mit drei deutlich größeren Waffensymbolen.
  Das Spielfeld bleibt rundum sichtbar. Die Auswahl
  bleibt geheim und nach dem Bestätigen gesperrt, bis beide gewählt haben.
  Bei erneutem Gleichstand erscheint die nächste Auswahlrunde am selben Ort.
- **Animierte Kämpfe:** Bei jedem Aufeinandertreffen kommen die beiden
  aufgedeckten Waffen in der Mitte zusammen. Eine kurze Kampfwolke erscheint,
  die Verliererwaffe zerbricht und der Sieger wird hervorgehoben. Farbe, Name
  und Beschriftung machen das Ergebnis auf beiden Seiten eindeutig. Auch
  Fallen und Flaggen werden passend zum tatsächlichen Ergebnis dargestellt.
- **Gemeinsamer Jubel:** Nach einem Kampfgewinn hüpfen kurz alle verbliebenen
  Figuren der siegreichen Mannschaft. Auch ein neu bestätigter Partiensieg
  ohne Kampf, beispielsweise nach einer Aufgabe, löst den Teamjubel aus.
  Die festen Spielerfarben gelten dabei in beiden Browsern.
- **Bewegungseinstellung bleibt wirksam:** Ohne Animationen oder bei aktivierter
  reduzierter Bewegung erscheint der Kampf als kurze statische Ergebnisanzeige.
  Die Waffenwahl bleibt bedienbar. Wiederholte Spielstandsübertragungen und
  Wiederverbindungen spielen vergangene Kämpfe oder Siege nicht erneut ab.
- **Gelbe Retro-Fallen:** Beide Spieler verwenden wieder die ursprüngliche
  goldgelbe Falle, jeweils in passender Vorder- oder Rückenansicht. SVG und die
  daraus erzeugte PNG zeigen dieselben Farben; die Kämpfer behalten ihre Teamfarbe.
- **Getauschte Zielflaggen:** Die blaue Mannschaft hat ein rotes Flaggentuch,
  die rote ein blaues. Körper, Sockel und Besitzerzuordnung bleiben in der
  jeweiligen Teamfarbe. Diese Zuordnung gilt auf dem Brett und bei einer
  Flaggeneroberung, auch in Klassisch, Arcade und im PNG-Rückfall. Die
  Schiedsrichterflaggen zeigen weiterhin die tatsächliche Zug- oder Siegerfarbe.
- **Schiedsrichter mit Farbe und Richtung:** Vier Zug-/Siegerposen decken Blau
  oben, Blau unten, Rot oben und Rot unten ab. Die neutrale Pose mit beiden
  Flaggen bleibt für Aufstellung, gleiche Waffen und Remis erhalten. Die
  Besitzerfarbe bleibt fest, die angezeigte Richtung folgt der jeweiligen
  Browserperspektive.
- **Größerer Schiedsrichter:** In der Spiel-Statuskarte steigt das Bild von
  136 × 102 auf 180 × 135 Pixel. Die sichtbare textliche Zugüberschrift wird
  weiterhin durch den Schiedsrichter ersetzt.
- **41 gemeinsame Atlasmotive:** Zwei zusätzliche native SVG-Posen belegen
  bislang freie Plätze. Die 39 bisherigen Ausschnittkoordinaten und die
  Atlasgröße 1728 × 2016 bleiben erhalten. Die PNG wird gemeinsam neu exportiert.
- **Erweitertes Grafikformat:** Das optionale `directionalTurnPortraits` wählt
  für jede Farbe `top` und `bottom`. Bestehende `colorTurnPortraits` und
  `turnPortraits` bleiben als Rückfall für eigene Grafiksets unterstützt.

## Neu in Version 0.4.4

- **Der gesamte Retro-Atlas als SVG:** 39 Motive auf **1728 × 2016** Einheiten:
  24 Basisfiguren für beide Farben und Blickrichtungen, sechs Aufdeckposen,
  zwei Brettkacheln, Logo, drei Schiedsrichterposen und drei einzelne Waffen.
  Die Oberfläche verwendet die SVG direkt; das Brett rendert sie passend zur
  benötigten Auflösung.
- **Feste Teamfarben:** Seat 0, der Raumersteller, ist blau; Seat 1 ist rot.
  Figuren, Namen, Punktestand, Zug- und Siegeranzeigen bleiben in beiden
  Browsern gleich zugeordnet. Eigene Figuren stehen weiterhin unten in der
  Rückenansicht; Gegner stehen oben in der Vorderansicht. Auch Fallen und
  Flaggen tragen ihre Teamfarbe. Klassisch und Arcade verwenden ebenfalls Blau/Rot.
- **Drei überarbeitete Schiedsrichterposen:** Nach den neuen Bildvorlagen zeigt
  die blaue Pose die Flagge vorn unten, die rote vorn oben. Die neutrale Pose
  streckt beide Flaggen seitlich aus und gilt unter anderem im Duell und bei Remis.
- **Echte Vektormotive:** Die Figurenkonturen wurden aus der bisherigen Vorlage
  in Pfade übertragen und ihre Schattierungen angenähert. Brettkacheln, Logo und
  Schiedsrichter verwenden auch native Vektorverläufe; die gezeichneten Waffen
  werden direkt übernommen. Der Atlas enthält keine eingebetteten Rasterbilder.
- **Passender PNG-Rückfall:** `atlas.png` wird aus dem vollständigen `atlas.svg`
  neu exportiert. Beide Dateien haben dieselben Maße, Motive und 39 Ausschnitte.
  Falls die SVG nicht verwendet werden kann, lädt das Set diese PNG automatisch
  über `atlas.fallbackImage`. Die PNG aus 0.4.3 liegt nur noch als Bearbeitungsquelle
  unter `design/icq-retro-source/original.png`.
- **Arcade ebenfalls mit SVG:** `master.svg` ist das primäre Bild, `atlas.png`
  die passende Rückfallgrafik. Die 147 Frames und vorhandenen Animationsclips bleiben erhalten.
- **Kleinere SVG-Übertragung:** Der Produktionsbuild ergänzt komprimierte
  SVG-Dateien für die Auslieferung. Browser mit gzip-Unterstützung übertragen
  den Retro-Atlas dadurch mit etwa 2,13 MB statt 9,9 MB. Die Adresse `atlas.svg`
  und die bearbeitbare Originaldatei bleiben erhalten; eigene NAS-Grafiken
  haben weiterhin Vorrang.
- **Bestehende Bedienung erhalten:** Die einzelnen Waffen in Regeln und Duell,
  die Schiedsrichter-Statuskarte und die lesbaren Auswahllisten bleiben erhalten.
  Im Retro-Design erscheinen weiterhin keine zusätzlichen gelben Aufdeckpunkte.

Der normale Build verwendet die mitgelieferten SVG-/PNG-Dateien. Die optionalen
Grafikwerkzeuge brauchst du nur, wenn du den Atlas selbst neu erzeugen möchtest.
Format und Bearbeitung stehen in [GRAFIKSETS.md](GRAFIKSETS.md).

## Neu in Version 0.4.3

- **Waffen einzeln dargestellt:** Ein grauer rundlicher Stein, eine helle
  Papierrolle und eine silberne Schere mit gelben Griffen passen zur Retro-Optik.
  Sie erscheinen in der Regelerklärung und bei jeder geheimen Waffenwahl im Duell,
  auch nach wiederholtem Gleichstand.
- **Echte Vektoren für die kleinen Symbole:** `weapon-atlas.svg` enthält die
  drei neu gezeichneten Motive als Vektorformen. Die Darstellung kann damit
  in verschiedenen Größen und bei höherer Bildschirmdichte sauber skalieren.
  Die Regelbilder sind 44 Pixel groß, die Bilder der Waffenwahl 56 Pixel.
- **Waffen auch in der Retro-Map:** Der Hauptatlas umfasst jetzt
  **1121 × 1787 Pixel mit 24 statischen Ausschnitten**. Die drei neuen
  Waffenbilder liegen in einer zusätzlichen Reihe; die bisher vorhandenen
  21 Motive und ihre Koordinaten bleiben erhalten. Sie dienen außerdem als
  Rückfall, falls der optionale Vektoratlas nicht geladen werden kann.
- **Schärferes Brett:** Der Zeichenpuffer berücksichtigt beim Start die
  Bildschirmdichte bis Faktor 2. So nutzt das logisch 680 × 616 große Brett
  bei DPR 2 und höher einen Puffer von 1360 × 1232 Pixeln.
- **Grafikset erweiterbar:** `weapons` ordnet die Einzelwaffen zu;
  `weaponAtlas` ergänzt bei Bedarf eine separate SVG-, PNG-, WebP- oder
  JPEG-Datei. Das bestehende Hauptbild für Brett und Figuren bleibt ein Rasteratlas.
  Format und Bearbeitung sind in [GRAFIKSETS.md](GRAFIKSETS.md) beschrieben.
- **Schiedsrichter als Zuganzeige:** In der Retro-Spielansicht erscheint er
  direkt in der Statuskarte an der Stelle der bisherigen textlichen Zuganzeige.
  Seine Flaggen zeigen den Spieler am Zug und nach Spielende den Sieger.
- **Lesbare Designauswahl:** Die aktive Option erhält im Retro-Menü einen
  dunkelolivgrünen Hintergrund und helle Schrift; die übrigen Optionen stehen
  dunkel auf hellem Hintergrund.
- **Aufdeckposen ohne gelbe Punkte:** Die zusätzlichen Aufdeckmarker entfallen
  im Retro-Design. Der Aufdeckstatus und die Figurenposen bleiben erhalten.

Für diese Änderung ist keine Anpassung der vorhandenen Caddy-Konfiguration nötig.

## Neu in Version 0.4.2

- **Einheitliche Aufdeckfiguren:** Die blaue Steinfigur unten links in der
  Grafik-Map dient als gemeinsame Figurenvorlage für Papier und Schere daneben.
  Nur das Werkzeug wird ausgetauscht; Kopf, Körper, Armhaltung, Ärmel und Hand
  folgen derselben Vorlage.
- **Passende Verdeckung:** Derselbe blaue Ärmel und dieselbe Hand liegen vor
  dem Werkzeug und verdecken dessen Rand.

## Neu in Version 0.4.1

- **Aufgedeckte eigene Kämpfer:** Blaue Stein-, Papier- und Scherenfiguren
  erhalten eine zusätzliche Pose mit dem Werkzeug vorn oder seitlich in einer
  Hand. Papier und Schere übernehmen die tiefe, natürliche Armhaltung der
  blauen Steinfigur; Kopf, Körper oder Hand dürfen einen Teil des Werkzeugs
  verdecken. Die Darstellung wechselt, sobald die Figur laut bestätigtem
  Spielstand öffentlich aufgedeckt ist.
- **Schiedsrichter zeigt den Zug:** Er hebt den Arm mit der aktiven Flagge;
  die andere hält er hinter dem Rücken. Rot bleibt in seiner anatomisch rechten
  Hand, Blau in seiner linken. In der neutralen Frontalansicht ist Rot daher
  links im Bild und Blau rechts. Blau bedeutet im jeweiligen Browser „du bist
  am Zug“, Rot „der Gegner ist am Zug“.
- **Sieger und Gleichstand:** Nach einem Sieg zeigt die Flagge die Farbe des
  Gewinners; die Beschriftung nennt den Sieger. Bei einem Remis zeigt der
  Schiedsrichter beide Arme mit den Flaggen ausgestreckt. Diese neutrale Pose
  gilt ebenfalls in Lobby, Wartephase, Aufstellung und im Duell, auch bei
  wiederholter gleicher Waffenwahl.
  Bei einer Verbindungspause während eines Zugs bleibt dessen Flaggenfarbe erhalten.
- **Erweiterte Bild-Map:** 21 statische Ausschnitte auf **1121 × 1403 Pixeln**,
  darunter drei zusätzliche aufgedeckte Figuren und zwei zusätzliche
  Schiedsrichterposen. Die neuen Darstellungen funktionieren auch bei
  ausgeschalteten Animationen.
- **Erweiterbares Grafikformat:** Eigene Sets können `revealed`-Varianten für
  Figuren und `turnPortraits` für den Schiedsrichter definieren. Ohne diese
  optionalen Angaben werden die bisherigen Figuren und das neutrale Porträt verwendet.

Die neue Version enthält keine neuen Figurenanimationsclips. Die vorhandenen
Zug- und Kampfdarstellungen bleiben nutzbar.

## Neu in Version 0.4.0

- **Serienmodus beim Erstellen:** Freie Serie, Best of 3 oder Best of 5.
  Eine freie Serie zählt die Siege beliebig vieler Partien weiter; Best of 3
  endet bei zwei, Best of 5 bei drei Siegen. Remis werden separat gezählt.
- **Gemeinsamer Punktestand:** Beide Namen, Siege, Remis, Serien- und
  Partienummer sowie der Startspieler stehen direkt über dem Brett.
- **Abwechselnder erster Zug:** Der Raumersteller beginnt die erste Partie;
  danach wechselt der Startspieler nach jeder Partie, auch nach einem Remis
  und beim Übergang in eine neue Serie.
- **Gemeinsame Fortsetzung:** Nach einer Partie wählen beide „Nächste Partie“
  oder „Neue Serie (0 : 0)“. Erst zwei übereinstimmende Stimmen starten neu.
  Nach dem entscheidenden Sieg einer Best-of-Serie steht nur die neue Serie
  zur Verfügung. Sie behält Modus, Spieler und Plätze bei.
- **Wiederbeitritt:** Eine rechtzeitige Wiederverbindung erhält die
  Spieleridentität, die laufende Partie und den Serienstand. Ausstehende
  Zustimmungen zur Fortsetzung werden bei einem Abbruch gelöscht.
- **ICQ Retro:** Zusammenhängendes grünes Schachbrett, blaue und rote
  Cartoon-Figuren, Stein, Papierrolle, Schere, Flagge, Falle, neues Logo und
  statischer Schiedsrichter aus einer echten PNG-Bild-Map.
- **Austauschbare Grafikdateien:** Der neue Atlas liegt zusammen mit seiner
  Konfiguration unter `public/skins/icq-retro/`. Die erste Retro-Map in 0.4.0
  enthielt 16 statische Bildausschnitte auf 1254 × 1254 Pixeln. Das Format lässt
  spätere Animationsclips zu; vorhandene Bewegungseffekte bleiben nutzbar.
- **Erweiterte Onlineprüfung:** Kontrolliert zusätzlich den ausgelieferten
  Retro-Atlas, Serienwertung, wechselnden Startspieler, Wiederbeitritt mit
  vorhandenem Siegstand und das gemeinsame Zurücksetzen.

„ICQ Retro“ ist die Vorgabe für Browser ohne gespeicherte Designauswahl.
Eine bestehende Auswahl bleibt erhalten; bei Bedarf im Menü **Design → ICQ Retro**
wechseln. „Klassisch“, „Arcade“ und eigene Grafiksets bleiben verfügbar.

**Bestehende QNAP-Installation aktualisieren:** [QNAP-UPDATE.md](QNAP-UPDATE.md)  
**Grafikset und eigene Bild-Maps:** [GRAFIKSETS.md](GRAFIKSETS.md)  
**Originalrecherche und Entstehung des Designs:** [design/ICQ-RETRO.md](design/ICQ-RETRO.md)

## Neu in Version 0.3.3

- **Token-Eingabe auf dem QNAP korrigiert:** Das Einrichtungsskript verwendet
  die verdeckte Eingabe `read -s` der NAS-Shell. Dafür ist kein `stty` erforderlich.
- **Klare Fehlerursachen:** Ein fehlendes Terminal und fehlende Möglichkeiten
  zur verdeckten Eingabe erhalten unterschiedliche Meldungen.
- **Geprüfter Abbruch:** Ein vorhandener Token bleibt bei Abbruch, leerer oder
  ungültiger Eingabe erhalten. Die normale Terminalanzeige wird wiederhergestellt.

## Neu in Version 0.3.2

- **DNS-Prüfung für Zertifikate:** ergänzende Caddy-Konfiguration für dynv6;
  Ausstellung und Erneuerung benötigen keine öffentlichen Ports 80 oder 443.
- **Bestehende Spieladresse:** `https://flusensieb.dns.navy:8443`, mit der
  FRITZ!Box-Weiterleitung **TCP 8443 → NAS 18443 → Caddy 443**.
- **Vorabtest:** eine eigene Caddy-Instanz prüft die echte DNS-Zertifikatsausstellung
  in der Let's-Encrypt-Testumgebung, bevor die laufenden Container umgestellt werden.
- **Token lokal erfassen:** unsichtbare Eingabe auf dem NAS, eigene Secret-Datei;
  kein Token in Compose, Projekt-ZIP oder Container-Image.
- **Bestehende Zertifikate erhalten:** derselbe Caddy-Dienst und dieselben Volumes.
  Die bisherigen Grafiksets, Animationen und Spielfunktionen sind vollständig enthalten.

**Einrichten und aktualisieren:** [QNAP-HTTPS.md](QNAP-HTTPS.md).
Für den DNS-Betrieb immer `-f compose.yaml -f compose.dns.yaml --profile https`
verwenden. Die ursprüngliche Variante für öffentliche Standardports steht in
[QNAP-HTTPS-STANDARD.md](QNAP-HTTPS-STANDARD.md).

## Neu in Version 0.3.1

- Optionaler **Caddy-Container** für HTTPS und sichere WebSocket-Verbindungen.
- Vorbereitet für `flusensieb.dns.navy` und die FRITZ!Box 6660 Cable:
  extern TCP 80/443, auf dem QNAP standardmäßig TCP 18080/18443.
- Caddy 2.11.7 mit automatisch erneuerten Zertifikaten in persistenten Volumes.
- Bestehendes Compose-Projekt `rps-arena`; Aktivierung über das Profil `https`.
- Online-Funktionsprüfung jetzt auch direkt im Spielcontainer verfügbar.

Die damalige Standardport-Konfiguration verwendet IPv4. Ein vorhandener
AAAA-Eintrag braucht einen gesondert funktionierenden IPv6-Zugang.

## Neu in Version 0.3

- **Designs wechseln:** Seit Version 0.3 im Menü „Design“ zwischen „Klassisch“, „Arcade“ und
  eigenen Grafiksets wechseln; Auswahl pro Browser speichern.
- **Eigene Bild-Map:** Ein PNG-/WebP-/JPEG-Atlas und eine JSON-Datei ersetzen
  Figuren, verdeckte Rückseiten, Spielfeldkacheln und Logosymbol. Die
  Spielfeld- und Oberflächenfarben lassen sich separat einstellen.
- **Animationen:** Bewegungen, Angriff im Bogen, Aufdecken, Entfernen des
  Verlierers und zwei Siegerpulse. Auch Duellbeginn, Gleichstand und
  aufgelöste Duellrunden erhalten eine sichtbare Darstellung. Eigene
  Bildfolgen für `idle`, `selected`, `move`, `duel`, `attack`, `win`, `lose`.
- **Letzter Zug:** Start, Ziel und Richtung bleiben markiert. Eine
  Ergebnisleiste nennt Beteiligte, Sieger und entfernte Figur.
- **Mehr Verlauf:** Die letzten 100 Ereignisse sind in der aufklappbaren
  Spielchronik lesbar.
- **Aufstellung per Ziehen:** Zwei eigene Figuren per Drag-and-drop tauschen;
  Anklicken und Tastatursteuerung funktionieren weiterhin.
- **Optionale Retro-Töne:** Kurze, lokal erzeugte Zugsignale und Kampftöne;
  zunächst ausgeschaltet. Animationen sind ebenfalls abschaltbar und
  beachten reduzierte Bewegung in den Systemeinstellungen.
- **NAS-Grafiken ohne Neubau:** Nach dem einmaligen Versionswechsel eigene
  Bild- und JSON-Dateien unter `skins/` bearbeiten und die Seite neu laden.
- **Fehlerfeste Darstellung:** Ungültige Grafiksets fallen auf das eingebaute
  klassische Design zurück. Wiederverbindungen spielen alte Ereignisse
  nicht erneut ab.

Die komplette ZIP enthält Quellcode, Grafikvorlagen, Tests, Docker-Konfiguration
und den aktuellen Produktionsbuild unter `dist/`.

**QNAP aktualisieren:** [QNAP-UPDATE.md](QNAP-UPDATE.md)  
**Eigene Grafiken erstellen:** [GRAFIKSETS.md](GRAFIKSETS.md)

## Schnellstart unter Windows, Linux oder macOS

Voraussetzung: Node.js ab **22.12**, beispielsweise Node.js 24, mit npm.
Prüfen: `node --version`. Falls Node fehlt: https://nodejs.org/en/download

1. ZIP entpacken und den Ordner `rps-remake` in VS Code öffnen.
2. Im Terminal dieses Ordners einmalig die Abhängigkeiten installieren:

   ```sh
   npm ci
   ```

3. Spielserver starten:

   ```sh
   npm start
   ```

4. Im Browser **http://localhost:2567** öffnen.

Die ZIP enthält zusätzlich zum Quellcode bereits den gebauten Stand unter
`dist/`. Deshalb ist für ihren ersten Start kein separater Build nötig.
Für einen aus dem Quellcode neu aufgebauten Stand vor `npm start` zunächst
`npm run build` ausführen. Für die Installation ist Internet nötig; danach
werden alle Spieldateien lokal ausgeliefert.

Alternativ unter Windows `Start-Windows.cmd` doppelklicken. Das Skript prüft
Node, installiert bei Bedarf die Abhängigkeiten und startet den Server.
Das Terminalfenster bleibt während des Spielens geöffnet. **Strg+C** beendet ihn.

## Erste Partie auf einem Rechner testen

- Name eingeben, den Serienmodus wählen und einen Raum erstellen.
- Einen **neuen** Browser-Tab öffnen und dort den Einladungslink einfügen.
  Einen vorhandenen Tab nicht per „Tab duplizieren“ kopieren: Browser können
  dabei den Sitzungsspeicher mitkopieren. Zwei unterschiedliche Browser oder
  ein normales und ein privates Fenster funktionieren ebenfalls.
- Zweiten Namen eingeben und dem Raum beitreten. Groß-/Kleinschreibung des
  Raumcodes ist relevant.
- Eigene Figuren durch Anklicken zweier eigener Felder oder Ziehen tauschen oder
  „Mischen“ verwenden. Danach auf beiden Seiten „Ich bin bereit“ wählen.
- In der ersten Partie beginnt der Raumersteller. Danach wechselt der erste
  Zug nach jeder Partie. Eigene Figur und anschließend ein markiertes
  Zielfeld anklicken. Pfeiltasten und Enter/Leertaste sind ebenfalls möglich,
  wenn das Spielfeld fokussiert ist.
- Unter dem Spielfeld eine Chatnachricht eingeben und mit Enter oder **Senden**
  abschicken. Sie erscheint bei beiden Teilnehmern mit Name und Teamfarbe.

## Auf zwei Geräten im LAN spielen

Nur **ein** Gerät startet den Server. Das Terminal zeigt neben `Lokal` die
gefundenen LAN-Adressen an, etwa `http://192.168.178.30:2567`.

**Beide Geräte öffnen diese LAN-Adresse** und treten demselben Raum bei. So
enthält auch der kopierte Einladungslink die passende Adresse. Ein Link mit
`localhost` zeigt auf dem zweiten Gerät auf das zweite Gerät selbst.

Falls Windows fragt, Node für das private Netzwerk zulassen. Geräte müssen
sich im Netzwerk erreichen können; isoliertes Gast-WLAN kann das verhindern.
Es ist keine Router-Portweiterleitung für eine reine LAN-Partie erforderlich.

## Was enthalten ist

- Phaser-Spieloberfläche mit Maus-, Touch- und Tastaturbedienung.
- Private, nicht öffentlich aufgelistete Zweispielerräume per Raumcode/Link.
- Eigene Aufstellung, Mischen, Tauschen und Bestätigen.
- Serverseitige Prüfung von Zugreihenfolge, Bewegung und Kampf.
- Verdeckte Gegnerdaten: unbekannte Figurentypen werden nicht an den Gegner
  übertragen. Auch die geheime Duellauswahl bleibt bis zur Auflösung privat.
- Geheime neue Waffenwahl bei gleichartigen Kämpfern, inklusive wiederholter
  Gleichstände und gleichzeitiger Eingaben beider Spieler.
- Serverseitiges Spielende und freiwilliges Aufgeben; eine weitere Partie
  oder eine neue Serie startet erst nach Zustimmung beider Seiten.
- Freie Serien, Best of 3 und Best of 5 mit Siegstand und separatem Remiszähler.
- Raumchat mit serverseitig bestätigten Absendern, getrenntem Verlauf und
  erhaltenen Entwürfen bei vorübergehenden Sendeproblemen.
- Pause bei Verbindungsabbruch. Standardmäßig bleibt der Platz **120 Sekunden**
  für die bisherige Sitzung reserviert; Neuladen im selben Tab kann die Partie
  innerhalb dieses Fensters fortsetzen. Eine erneute erfolgreiche Verbindung
  erzeugt einen neuen Rückkehrtoken.
- Vollständig vektorisierter Retro-Atlas mit erhaltener PNG-Vorlage,
  frisch exportiertem PNG-Rückfall, eingebaute Vektorsymbole und der animierte
  Arcade-Vektoratlas mit PNG-Rückfall; alle Grafiken und Schriften werden
  lokal beziehungsweise über verfügbare Systemschriften dargestellt.
- Regeltests und Integrationstests mit echten Colyseus-Clients.

## Raumchat

Der Chat erscheint im Raum unter dem Spielfeld. **Enter** oder **Senden** schickt
die eingegebene Nachricht ab. Der Server bereinigt Steuerzeichen und Zeilenumbrüche,
entfernt äußere Leerzeichen und akzeptiert bis zu **300 Unicode-Zeichen**. Leere
oder zu lange Nachrichten werden mit einem Hinweis abgewiesen; der Entwurf
bleibt erhalten. Zwischen neuen Nachrichten desselben Spielers liegen mindestens
500 Millisekunden. Namen und feste Teamfarben stammen vom Server.

Der Verlauf enthält die letzten **50 Nachrichten dieses Raums**. Er bleibt bei
einer nächsten Partie, einer neuen Serie und bei der Wiederverbindung zur selben
Sitzung erhalten. Während der Gegner kurz getrennt ist oder die Partie bereits
beendet wurde, kann der verbundene Teilnehmer weiterhin schreiben. Ein neuer
Raum beginnt mit leerem Verlauf. Chatnachrichten liegen nur im Arbeitsspeicher:
Beim Ende des Raums oder einem Serverneustart geht dieser Verlauf verloren.

## Vorläufige Regeln

Dies ist ein **spielbarer Prototyp**, noch keine vollständig verifizierte
1:1-Rekonstruktion aller historischen ICQ-Sonderregeln. Folgende Regeln sind
bewusst konkret festgelegt und stehen zentral in `shared/game.ts`:

| Bereich | Festlegung |
| --- | --- |
| Brett | 7 Spalten × 6 Reihen |
| Armee | Je 4 Stein, 4 Papier, 4 Schere, 1 Flagge, 1 Falle |
| Teamfarbe und Ansicht | Raumersteller / Seat 0 blau, zweiter Spieler / Seat 1 rot; eigene Figuren unten, Gegner oben; im Retro-Set als Rücken- beziehungsweise Vorderansicht |
| Aufstellung | Je zwei eigene Startreihen; zwei mittlere Reihen bleiben frei |
| Aufbau | Zufällige Startaufstellung, freies Tauschen/Mischen bis „Bereit“ |
| Zug | Ein beweglicher Kämpfer ein Feld waagerecht oder senkrecht |
| Flagge/Falle | Beide unbeweglich |
| Kampf | Stein schlägt Schere, Schere schlägt Papier, Papier schlägt Stein |
| Gleiche Typen | Beide wählen geheim neu; Gleichstand wiederholt die Auswahl |
| Neue Waffe | Der überlebende Kämpfer behält seine letzte gewählte Waffe |
| Aufdecken | Am Kampf beteiligte Figuren bleiben aufgedeckt |
| Falle | Angreifer verschwindet; Falle bleibt aufgedeckt auf dem Brett |
| Sieg | Gegnerische Flagge erobern, Gegner hat keinen legalen Zug oder gibt auf |
| Zuglimit | Nach 300 abgeschlossenen Zügen unentschieden, sofern zuvor kein Sieg eintritt |
| Zugzeit | Kein Zeitlimit für einen einzelnen Zug oder eine Duellauswahl |
| Serien | Frei ohne Siegziel; Best of 3 bis zwei Siege; Best of 5 bis drei Siege |
| Remis | Erhöht den Remiszähler, vergibt keinen Sieg und zählt nicht zum Siegziel |
| Startspieler | Wechselt nach jeder Partie, auch über eine Seriengrenze hinweg |
| Fortsetzung | Beide stimmen für dieselbe Option: nächste Partie oder neue Serie |

Die Aufdeckung bleibt ein Spielzustand. ICQ Retro verwendet dafür die
vorgesehenen Figuren- und Aufdeckposen und zeigt keine zusätzlichen gelben
Punkte. Andere Darstellungen behalten ihre Aufdeckmarker.

Vor allem Verhalten der Falle, dauerhafte Sichtbarkeit, Waffenverteilung,
Startspieler und Regeln gegen Endlosschleifen sollen wir nach deinem Feedback
mit der gewünschten Originalvariante abgleichen. Ein kompletter Serverneustart
beendet aktuell alle laufenden Partien und Serien; Spielstände und Chatverläufe
liegen nur im Speicher.
Nach dauerhaftem Verlassen wird eine Partie beendet. Ein neuer Spieler darf
den alten Platz nicht übernehmen; für einen anderen Gegner einen neuen Raum
erstellen. Räume und Sitzungen sind getrennt, benötigen derzeit kein Konto.

## Projektaufbau

| Pfad | Aufgabe |
| --- | --- |
| `client/main.ts` | Menüs, Spielphasen und Interaktion |
| `client/series-ui.ts` / `client/series.css` | Serienstand, Bezeichnungen und Fortsetzungszustände |
| `client/chat-ui.ts` / `client/chat-ui.css` | Raumchat, Entwurf, Nachrichtenliste und Eingabe |
| `client/combat-ui.ts` / `client/combat-ui.css` | Waffenwahl und zentrale Kampfpräsentation |
| `client/board.ts` | Phaser-Brett, Atlas-Sprites, Animationen, Markierungen und Bedienung |
| `client/board-motion.ts` | Ereigniserkennung und Bildfolgen ohne Wiederholung nach Wiederverbindung |
| `client/skins.ts` / `client/skin-types.ts` | Grafikset-Format, Laden, Validieren und Standardwerte |
| `client/skin-ui.ts` | Logo, Figuren- und Waffensymbole, Atlas-Ausschnitte und Oberflächenfarben |
| `client/referee-ui.ts` | Statische Schiedsrichterpose für die feste Farbe des Zugspielers oder Siegers |
| `client/team-ui.ts` | Feste Zuordnung von Spieler-Seat zu Blau/Rot, unabhängig vom Betrachter |
| `client/retro.css` | Am ICQ-Spiel orientierte Oberfläche des Retro-Grafiksets |
| `client/sound.ts` | Optionale, lokal erzeugte Spielsounds |
| `public/skins/` | Mitgelieferte Designs, PNG-Atlas, SVG-Master und Konfiguration |
| `public/skins/icq-retro/` | SVG-Atlas mit 43 Motiven auf 2016 × 2016, passende PNG-Rückfallgrafik und bearbeitbare Waffenquelle |
| `scripts/build-retro-atlas.py` | Optionaler gemeinsamer Neubau von SVG, PNG und Grafikmanifest |
| `scripts/retro_vectorize.py` | Pfadvektorisierung der Figuren mit Pillow und libpotrace |
| `scripts/build-retro-weapons.mjs` | Kompatibler Aufruf des vollständigen Python-Grafikbuilds |
| `scripts/compress-skin-svgs.mjs` | Ergänzt gzip-Dateien für die eingebauten SVGs im Produktionsbuild |
| `design/icq-retro-source/` | PNG-Bearbeitungsvorlage aus 0.4.3, Ausschnittplan sowie Schiedsrichter und Flaggensieger als native SVG-Quellen |
| `design/` | Recherchequellen, Designentscheidungen und verwendete Bildprompts |
| `skins/` | Eigene Grafiksets als austauschbare NAS-Dateien |
| `client/network.ts` | Verbindung, Raumbeitritt, Sitzung und Wiederverbindung |
| `client/styles.css` | Responsives Design |
| `shared/game.ts` | Maßgebliche Spielregeln und Sicht pro Spieler |
| `shared/protocol.ts` | Geteilte Nachrichtentypen |
| `shared/chat.ts` | Zeichengrenze, Textbereinigung und gültige Nachrichtenkennungen |
| `server/RpsRoom.ts` | Colyseus-Raum, validierte Aktionen und private Zustandsnachrichten |
| `server/chat.ts` | Raumverlauf, serverseitige Absenderdaten, Mindestabstand und Wiederholschutz |
| `server/app.ts` | HTTP-/WebSocket-Server, Spiel- und Grafikauslieferung, Health-Endpunkte |
| `server/index.ts` | Serverstart und Netzwerkadressen |
| `tests/game.test.ts` | Fachliche Regel- und Geheimhaltungstests |
| `tests/network.test.ts` | Integration mit getrennten Clients und echten Verbindungen |
| `tests/game-series.test.ts` / `tests/network-series.test.ts` | Wertung, Serienwechsel, Zustimmung und Wiederverbindung |
| `tests/chat.test.ts` / `tests/network-chat.test.ts` | Chatvalidierung, Raumtrennung, Wiederholschutz und Verlauf über Wiederverbindung und Partiewechsel |

Die vollständigen gegnerischen Figuren bleiben im `GameState` des Servers.
`viewFor()` baut für jeden Spieler explizit ein eigenes, gefiltertes `GameView`.
Öffentliche Aktionen werden zusätzlich als `lastAction` übertragen. Sie enthalten
nur die für diesen Betrachter sichtbaren Figuren. Ein besiegter Kämpfer wird
für seine kurze Darstellung aus dem bestätigten Kampfereignis gelesen. Bei
der ersten geheimen Duellwahl wird kein neues öffentliches Ereignis erzeugt.

Der private Zustand wird **nicht** dem automatisch synchronisierten
`Room.state` zugewiesen. Für das kleine Brett werden nach Aktionen komplette,
gefilterte Ansichten als `snapshot` gesendet. Colyseus übernimmt Räume, Plätze,
Transport und Wiederverbindung.

Züge tragen eine Spielstandsrevision. Dadurch werden doppelte oder veraltete
Zugbefehle verworfen. Duellwahlen tragen eine Duell-ID und Rundennummer; eine
globale Revisionsprüfung wäre hier falsch, weil beide Spieler gleichzeitig
wählen dürfen. Eine bereits bestätigte Wahl kann nicht geändert werden.
Die Zustimmung zur Fortsetzung trägt Serien- und Partiekennung. So können
beide Spieler gleichzeitig zustimmen, während alte Stimmen aus einer früheren
Partie keine neue Partie auslösen.

Der Raumchat verwendet getrennte Nachrichten: `chat_send` enthält Kennung und
Text, `chat` den bestätigten Raumverlauf, `chat_problem` einen Eingabe- oder
Sendehinweis. Spieler-ID, Name, Seat, Zeit und fortlaufende Nachrichten-ID setzt
der Server aus der verbundenen Sitzung. Chat verändert weder `snapshot` noch
Spielrevision oder `lastAction`. Eine Kennung darf aus 1 bis 64 ASCII-Buchstaben,
Ziffern, Unterstrichen und Bindestrichen bestehen; gleiche Kennungen desselben
Spielers werden innerhalb der letzten 50 Einträge nur einmal aufgenommen.

## Weiterentwickeln

```sh
npm run dev
```

Startet den Server auf Port 2567 und Vite auf Port 5173. Spieloberfläche unter
**http://localhost:5173** öffnen. Im Entwicklungsmodus verbindet sie sich mit
demselben Host auf Port 2567. Änderungen am Server starten ihn neu und beenden
damit die aktuellen Partien und Chatverläufe. Vite aktualisiert die Oberfläche während der
Entwicklung. Bei einem anderen Serverport `VITE_SERVER_URL` passend setzen.

```sh
npm test
npm run build
```

`npm test` führt Regel- und Netzwerktests aus. `npm run build` prüft TypeScript
und erzeugt Browser- und Serverdateien unter `dist/`. Der lokale Teststart
benötigt freie Loopback-Sockets. Die Netzwerktests starten und beenden ihren
eigenen Server an einem automatisch gewählten freien Port.

### Prüfstand dieser Lieferung

Der genaue Prüfstand dieser ZIP steht in [PRUEFBERICHT.md](PRUEFBERICHT.md).
Automatisierte Tests prüfen Regeln, zwei echte Netzwerkclients, Wiederverbindung,
Geheimhaltung der neuen Ereignisse, Raumchat, Grafikset-Fehlerfälle und NAS-Dateiauslieferung.
TypeScript und Browser-/Serverbuild werden vor der Auslieferung geprüft.

Der LAN-Betrieb auf dem QNAP TS-251D und die bestehende DNS-01-HTTPS-Einrichtung
unter `https://flusensieb.dns.navy:8443` wurden bereits bestätigt. Die neue
Version **0.4.7** wird als vollständige ZIP geliefert und anschließend von dir
auf dem NAS installiert und mit der Onlineprüfung kontrolliert. Die bisherige
Installation allein bestätigt noch nicht den Betrieb der neuen Version.
Die Regeln bleiben die dokumentierten
Prototypregeln; die genaue historische ICQ-Variante ist noch nicht vollständig
verifiziert.

## Konfiguration

Der Server liest Umgebungsvariablen des Prozesses; `.env.example` dokumentiert
die Werte. Beim direkten Start mit Node wird `.env` nicht automatisch geladen.
Docker Compose liest sie für die Variablen seiner Konfiguration; Vite liest
seine eigenen `.env`-Dateien für den Browserbuild.

| Variable | Standard | Bedeutung |
| --- | --- | --- |
| `PORT` | `2567` | HTTP und WebSocket auf demselben Port |
| `HOST` | `0.0.0.0` | Für das LAN erreichbar; `127.0.0.1` beschränkt auf denselben Rechner |
| `RECONNECT_SECONDS` | `120` | Rückkehrfenster, 1 bis 600 Sekunden |
| `ALLOWED_ORIGINS` | leer | Optional: zugelassene Browser-Ursprünge für WebSocket, kommasepariert |
| `SKINS_DIR` | leer | Optionaler Ordner für Grafik-Overrides; in Compose `/app/skins` aus `./skins` |
| `VITE_SERVER_URL` | automatisch | Optionaler Server-Ursprung für die Client-Entwicklung; Vite liest seine `.env`-Dateien |

Für Docker Compose kommen `RPS_DOMAIN` (`flusensieb.dns.navy`), `RPS_PORT`
(`2567`), `RPS_HTTP_PORT` (`18080`) und `RPS_HTTPS_PORT` (`18443`) hinzu.
`ALLOWED_ORIGINS` bleibt standardmäßig leer, sodass LAN und HTTPS nutzbar
sind. Wer die Liste einschränkt, muss auch die gewünschten LAN-Ursprünge
einschließlich Protokoll und Port aufnehmen. Für die öffentliche Spieladresse
gehört dabei `:8443` ausdrücklich zum Ursprung. Im DNS-Modus wird
`RPS_HTTP_PORT` nicht veröffentlicht; der HTTP-Token liegt separat in
`secrets/dynv6_api_token`.

Beispiel für PowerShell:

```powershell
$env:PORT = "3000"
npm start
```

## Internetbetrieb

Für das vorhandene QNAP und die FRITZ!Box gilt [QNAP-HTTPS.md](QNAP-HTTPS.md).
Das optionale Compose-Profil `https` ergänzt den bestehenden Spielcontainer
um Caddy. Für den Betrieb über dynv6-DNS zusätzlich `compose.dns.yaml` laden. Browser und Spielverbindung verwenden denselben öffentlichen
Ursprung; eine eigene WebSocket-Adresse im Client ist nicht erforderlich.

Dieselben Dateien können auf einen Host mit einem dauerhaft laufenden
Node.js-Prozess umziehen. Browserdateien und Multiplayer laufen auf derselben
Domain. Für den öffentlichen Zugriff HTTPS und WSS über den Host beziehungsweise
einen Reverse Proxy einrichten, der WebSocket-Upgrades unterstützt.

Eine Dockerdatei mit Tests, Produktionsbuild und Bereitschaftsprüfung ist enthalten:

```sh
docker build -t rps-arena .
docker run --rm -p 2567:2567 rps-arena
```

Als alternative Bereitstellung bleibt die bisherige Vorbereitung enthalten.
`render.yaml` konfiguriert die Bereitstellung; `ONLINE-START.md` beschreibt
GitHub, Render, Kosten, Prüfung und spätere Updates. Der Dockerbau wurde in
dieser Umgebung nicht ausgeführt. Konten, öffentliche Spielersuche, Rangliste,
KI und eine dauerhafte Spielstanddatenbank sind weitere Ausbauschritte.

## Technische Referenzen

- Phaser: https://phaser.io/why-phaser
- Colyseus-Räume: https://docs.colyseus.io/room
- Wiederverbindung: https://docs.colyseus.io/room/reconnection
- Bereitstellung: https://docs.colyseus.io/deployment

Der geprüfte Abhängigkeitsbaum steht in `package-lock.json`; `npm ci` installiert genau den geprüften Abhängigkeitsbaum.


<!-- Deployment-Status-Test 2026-10-13 -->
