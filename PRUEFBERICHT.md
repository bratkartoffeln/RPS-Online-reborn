# Prüfbericht – RPS Arena v0.4.5

Prüfstand: **12. Oktober 2026**. Diese Version ergänzt die zentrale Waffenwahl,
Kampfpräsentationen und Mannschaftsjubel, tauscht die Zielflaggen und erweitert
den Retro-Schiedsrichter um beide zusätzlichen Farbrichtungen. Geprüft wurden
der lokale Produktionsserver, echte getrennte Browserclients und die
ausgelieferten Grafikdateien.

**Ergebnis: 173 automatisierte Tests und der vollständige
Produktionsbuild sind bestanden.** Die lokale Onlineprüfung und die unten
aufgeschlüsselten funktionalen Browserprüfungen sind erfolgreich. Ein Build
oder eine Installation dieser Version auf dem QNAP wurde hier nicht ausgeführt.

## 1. Ergebnisübersicht

| Prüfung | Ergebnis |
| --- | --- |
| Automatisierte Tests | **173 bestanden**, keine fehlgeschlagenen, abgebrochenen oder übersprungenen Tests. |
| Produktionsbuild | Client- und Server-TypeScript, Vite-Build, SVG-Komprimierung und Serverausgabe für **0.4.5** erfolgreich. |
| Lokale Onlineprüfung | Version, Bereitschaft, Browserdateien, SVG und PNG, zwei Verbindungen, Geheimhaltung, Zug, Serienwertung, gemeinsame Fortsetzung und Wiederbeitritt bestanden. |
| Schiedsrichter im Browser | **36 Prüfungen** mit SVG und erzwungenem PNG-Fallback: neutrale Pose, beide Farben, beide Richtungen, Siege und Rückspiel. |
| Brett und Grafiken | **12 Perspektivprüfungen**, vier Atlas-/Dichtekontexte, vier Fallenprüfungen und vier Spielsiege erfolgreich. |
| Kampfüberlagerung | **24 Kampffälle funktional bestanden**, davon 10 auf der abschließenden Animationssteuerung; zusätzliche Prüfungen von Wiederbeitritt, Rückspiel, Aufgabe und Abbruch. Grenzen der Zwischenbilderfassung siehe Abschnitt 4. |
| Zielflaggen | Retro: vier Flaggenframes geändert; Arcade: 24 Flaggenframes geändert; klassische Vektordarstellung und DOM-Ersatzgrafik angepasst. |
| Paket | Vollständiger Projektordner mit Quellen, fertigen Grafiken, gebautem Client/Server und QNAP-Anleitung. |

Die Messungen stammen aus den Prüfläufen für 0.4.5. Ergebnisse der vorherigen
Version werden nicht als aktuelle Tests gezählt. Die Grafikprüfung verwendet
dieselben unveränderten Atlasdateien wie das ausgelieferte Paket. Nach der
abschließenden Änderung der Animationssteuerung wurden der Produktionsbuild,
die automatisierten Tests und die betroffenen Browserabläufe erneut geprüft.

## 2. Automatisierte Prüfung

Die Tests decken weiterhin Regeln, verdeckte Figuren, geheime Duellwahlen,
Serienwertung, Wiederverbindung, Grafikset-Validierung und Dateiauslieferung ab.
Für dieses Update sind insbesondere diese Fälle enthalten:

- **Öffentliche Kampfinformationen:** Die Präsentation verwendet ausschließlich
  das vom Server veröffentlichte Kampfereignis. Verdeckte Figuren und die
  noch geheime gegnerische Wahl werden nicht aus dem Brett oder vorherigen
  Spielständen rekonstruiert.
- **Bestätigter Sieger:** Gewinner und Verlierer folgen dem bestätigten
  Ergebnis und den entfernten Figuren. Alle sechs unterschiedlichen
  Stein–Papier–Schere-Paarungen, Gleichstände, Fallen und Flaggen werden
  berücksichtigt. Unvollständige oder widersprüchliche Ereignisse erzeugen
  keinen erfundenen Gewinnerjubel.
- **Geheime neue Wahl:** Nur die eigene bestätigte Wahl wird markiert. Bereits
  gesendete beziehungsweise gesperrte Entscheidungen bleiben gesperrt;
  bei einem weiteren Gleichstand wird die neue Runde freigegeben.
- **Farbe und Blickrichtung:** Seat 0 bleibt in beiden Browsern blau, Seat 1
  rot. Der eigene Spieler steht unten, der Gegner oben. Die Schiedsrichterpose
  kombiniert diese Perspektive mit der absoluten Besitzerfarbe. Aufstellung,
  Duell und Remis bleiben neutral; ältere Grafiksets behalten ihre Rückfallpfade.
- **Mannschaftsjubel:** Zwei Sprünge verwenden ausschließlich visuelle
  Positionsversätze und enden exakt auf der Ausgangsposition. Entfernte Figuren
  und gegnerische Figuren gehören nicht zur jubelnden Mannschaft.
- **Einmaliges Spielende:** Ein frischer Sieg ohne neues Kampfereignis löst
  ebenfalls Jubel aus. Wiederholte Zustände, Wiederbeitritt, fremde oder neue
  Match-Identitäten und Remis erzeugen keinen nachträglichen Jubel.
- **Zielflaggen:** Der klassische SVG-Ersatz zeigt rotes Tuch für die blaue
  Besitzerfigur und blaues Tuch für die rote, in beiden Perspektiven. Eigene
  Atlasgrafiken behalten Vorrang.
- **Grafikauslieferung:** Primäre SVG und konfigurierte Rasterrückfälle,
  Frame-Grenzen, eigene NAS-Grafiken, MIME-Typen, gzip-Aushandlung und sichere
  Dateipfade bleiben Bestandteil der Tests.

Zwei zusätzliche Tests prüfen die abschließende Animationssteuerung: Nur das
richtige `animationend` am richtigen Element schaltet weiter; hochgereichte oder
fremde Ereignisse bleiben wirkungslos. Eine Phase wird höchstens einmal beendet.
Entfernte Knoten können die Ersatzdarstellung nicht fortschalten. Bei ausbleibenden
Animationsereignissen greift ein begrenzter Ersatz-Timer.

## 3. Aktuelle Grafikdateien

| Set | Primäres Bild / Rückfall | Zeichenfläche | Frames |
| --- | --- | --- | ---: |
| ICQ Retro | `atlas.svg` / `atlas.png` | 1728 × 2016 | 41 |
| Arcade | `master.svg` / `atlas.png` | 1152 × 1248 | 147 |
| Klassisch | Direkt gezeichnete Vektorformen | an das Brett angepasst | kein Atlas |

Der Retro-Atlas enthält **1496 native SVG-Pfade**, 1356 eindeutige SVG-IDs
und 5591 gültige lokale Referenzen. Er enthält weder eingebettete Rasterbilder
noch Skripte oder externe Bildressourcen. Die PNG wurde aus demselben SVG neu
exportiert und verwendet dieselben Ausschnittkoordinaten.

Gegenüber 0.4.4 bleiben alle **39 bisherigen Frame-Koordinaten** erhalten.
31 der bisherigen PNG-Ausschnitte sind pixelgleich; geändert wurden genau die
vier Fallen- und vier Flaggenansichten. Die beiden neuen Schiedsrichterframes
heißen `referee-blue-top` und `referee-red-bottom`. Zusammen mit den vorhandenen
beiden Zugposen und der neutralen Haltung sind fünf Schiedsrichtermotive verfügbar.

### Ziel- und Schiedsrichterflaggen

| Besitzer der Figur | Tuchfarbe der Zielflagge | Spielerfarbe in beiden Browsern |
| --- | --- | --- |
| Blaue Mannschaft | Rot | Blau |
| Rote Mannschaft | Blau | Rot |

Nur das Tuch der Zielflaggen wechselt die Farbe. Körper beziehungsweise Sockel,
Mast und Spielerzuordnung bleiben erhalten. Die Schiedsrichterflagge folgt
weiterhin der Farbe des Spielers am Zug beziehungsweise des Siegers und zeigt
zur passenden Spielfeldseite. Ihre Darstellung misst **180 × 135 CSS-Pixel**.

Die Retro-Fallen beider Besitzer sind pro Blickrichtung pixelgleich goldgelb.
Zusätzliche gelbe Aufdeckpunkte bleiben im Retro-Design ausgeblendet. Im
Arcade-Atlas wurden die beiden Tuchflächen aller 24 Flaggenframes geändert;
die übrigen **123 Frames** und das Manifest sind unverändert.

### Auslieferungsgrößen

| Grafik | SVG | Gebauter gzip-Sidecar | PNG-Fallback |
| --- | ---: | ---: | ---: |
| Retro | 9.935.001 Byte | 2.135.687 Byte | 1.569.642 Byte |
| Arcade | 387.412 Byte | 10.196 Byte | 377.067 Byte |

Die Quelldateien unter `public/skins` stimmen bytegenau mit den gebauten
Grafiken unter `dist/client/skins` überein. Der normale Build verwendet die
mitgelieferten fertigen Grafiken. Pillow, libpotrace und Inkscape sind nur für
eine erneute Bearbeitung beziehungsweise Erzeugung der Atlasgrafiken nötig.

## 4. Browserprüfung

Die Browserprüfung verwendet getrennte echte Chromium-Kontexte und den lokalen
Produktionsserver. Für gezielte Kampffälle wurden kontrollierte Ausgangsstellungen
auf dem Testserver vorbereitet; Züge, geheime Wahlen, Rückspielzustimmungen und
Aufgaben erfolgten anschließend über die tatsächliche Browseroberfläche.

### Grafiken, feste Farben und Schiedsrichter

Der Grafiklauf umfasst Desktop bei **DPR 2** und eine mobile Ansicht mit
390 Pixel Fensterbreite bei **DPR 3**, jeweils mit primärer SVG und absichtlich
fehlender SVG für den PNG-Rückfall. Geprüft wurden:

- Blaue und rote eigene Rückenansichten unten sowie gegnerische Vorderansichten
  oben, in Aufstellung, Spiel und Rückspiel.
- Alle vier Schiedsrichter-Farbrichtungen, die größere Darstellung und die
  dazugehörige barrierefreie Beschriftung. Die Grafik passt in beide Layouts.
- Neutraler Schiedsrichter bei erster und wiederholter gleicher Waffenwahl.
- Blaue und rote Siege, wechselnder Startspieler und unveränderte Besitzerfarben
  in der nächsten Partie.
- Gleichfarbige goldgelbe Fallen für beide Seiten sowie korrekt geladene
  vollständige SVG- und PNG-Atlanten.

Die interne Retro-SVG-Textur misst bei DPR 2 und 3 **3456 × 4032 Pixel**;
im PNG-Fallback bleibt sie bei **1728 × 2016**. Das sind interne Texturmaße,
nicht die sichtbaren CSS-Abmessungen. Eine optionale mobile Screenshotaufnahme
lief in ein Zeitlimit; die zugehörigen funktionalen Prüfungen waren erfolgreich.

### Waffenwahl, Kämpfe und Jubel

Der erste Funktionslauf umfasst 14 Fälle: das erste Aufeinandertreffen mit
gleichen Waffen, zwei weitere Gleichstände und die entscheidende Wahl, alle
sechs verschiedenen Waffenpaarungen, einen Fallenkampf, ein 320 Pixel breites
Fenster sowie abgeschaltete Animationen und reduzierte Systembewegung. Die
private eigene Wahl ist markiert und gesperrt; die gegnerische Entscheidung
bleibt bis zur gemeinsamen Aufdeckung unsichtbar. Bei 320 Pixeln passen
Überschrift, beide Waffen und Ergebnis vollständig ins Brett, ohne horizontalen
Überlauf.

Nach der Änderung der Phasensteuerung wurden zehn weitere Kampffälle auf dem
abschließenden Build geprüft:

- Ein erster SVG-Kampf unmittelbar nach dem Laden mit blauem Sieger und danach
  ein roter Verteidigersieg. Beide Browser zeigen jeweils Annäherung, Aufprall,
  Zerbrechen und Siegerphase. Die Waffen überlappen sich tatsächlich um rund
  37 Pixel am Desktop beziehungsweise 34 Pixel im mobilen Layout. Die Wolke
  erreicht Opazität 1; der Gewinner wächst sichtbar auf etwa Faktor 1,15.
- Beide Gewinnerfarben jubeln mit ihrer jeweils vollständigen verbleibenden
  Sechsermannschaft. Jede Siegerfigur führt zwei Sprünge aus; die fünf übrigen
  gegnerischen Figuren bleiben auf ihrer Höhe. Anschließend sind sämtliche
  Positionen wieder exakt hergestellt.
- Kämpfe mit Klassisch und Arcade sowie eine Flaggeneroberung mit anschließendem
  Spielende. Das bestätigte Ergebnis und die Besitzerfarben stimmen in beiden
  Browsern überein.
- Erzwungener PNG-Fallback mit erstem Gleichstand, zwei erneuten Geheimwahlrunden,
  Entscheidung und anschließendem rotem Verteidigersieg. Auswahl und Kampf
  verwenden die PNG-Motive und denselben Ablauf.

Zusätzliche echte Oberflächen- und Verbindungsprüfungen bestätigen:

- Ein identischer Spielstand und ein tatsächlicher Socket-Abbruch mit
  automatischem Wiederbeitritt wiederholen weder Kampf noch Jubel.
- Nach der Flaggeneroberung starten beide Spieler gemeinsam eine neue Partie.
  Aufstellung und Spielbeginn wiederholen keine alte Animation. Nach einer
  bestätigten Aufgabe jubeln **alle 14 blauen Figuren jeweils zweimal**;
  alle 14 roten Figuren bleiben still. Es erscheint kein erfundenes Kampfereignis.
- Abschalten der Animationen während eines laufenden Kampfes wechselt sofort
  zur statischen Ergebnisdarstellung und erzeugt keinen nachträglichen Sprung.
- Verlassen während eines laufenden Kampfes führt zur Lobby und entfernt das
  Overlay. Auch nach mehr als 2,5 Sekunden treten keine verspäteten Kampf-
  oder Jubelaufrufe auf.

Die ergänzende Browserprüfung wurde bei DPR 1 ausgeführt. Die separate
Grafikprüfung bei DPR 2 und 3 bleibt für Schärfe, Texturmaße und PNG-Rückfall
maßgeblich. Die neuen Browserkontexte haben nachweislich die abschließenden
Dateien `index-CnjEFO_S.js` und `index-ZPuJG4PF.css` geladen. Es wurden keine
JavaScript-Fehler oder unerwartet fehlgeschlagenen Ressourcen festgestellt.

Die zentrale Waffenwahl zeigt **„Wähle deine Waffe“** mit 88 Pixel großen
Einzelmotiven, auf schmalem Brett mit 64 Pixeln. Der Overlay-Hintergrund ist
transparent; Überschrift, Status und Schaltflächen besitzen lokale, leicht
durchsichtige Flächen zur Lesbarkeit. Die Kampfsymbole messen 104 Pixel,
auf schmalem Brett rund 81 Pixel.

Die Sichtprüfung der tatsächlichen Browseraufnahmen bestätigt die mobile
Waffenwahl, die großen Einzelmotive, die sichtbare Kampfwolke über dem Brett
und die Zuordnung der Spielernamen zu Blau und Rot. Kontaktbögen der getauschten
Zielflaggen, der vier Schiedsrichterrichtungen und der gelben Fallen wurden
zusätzlich geprüft.

### Zeitverhalten und Grenzen der Messung

Die Software-Grafikausgabe der Prüfumgebung lieferte beim ersten SVG-Kampf
anfangs nur wenige Bilder. Die ursprünglichen unabhängigen Phasentimer konnten
dabei schon zum Ergebnis wechseln, bevor die Wolke sichtbar wurde. Deshalb
wurde die Steuerung angepasst: Jede Phase wartet nun auf das Ende ihrer eigenen
CSS-Animation; die Wolke beginnt bereits sichtbar. Alte Listener und Timer
werden bei Abbruch, Skinwechsel oder ausgeschalteter Bewegung entfernt.

Der neue kalte SVG-Test erfasst die vollständige Phasenfolge, die sichtbare
Wolke und den Siegerpuls in beiden Browsern. Bewegte Verliererfragmente sind
ebenfalls in beiden Browserperspektiven tatsächlich nachgewiesen, allerdings
nicht in jedem einzelnen kurzen Kampf: Beim ersten Desktop-Kampf wurde nur
ein Fragmentbild am Ausgangspunkt erfasst, im mobilen Browser desselben Kampfes
mehrere bewegte Bilder. Beim folgenden roten Sieg liegt der Bewegungsnachweis
am Desktop vor; dort ist die mobile Erfassung dünner.

Insgesamt sind acht solche Erfassungslücken des aktuellen Builds dokumentiert.
Dazu gehört der spätere Flaggenkampf nach mehreren Designwechseln: Ergebnis,
Phasenfolge und Gewinnerjubel sind geprüft, einzelne Aufprall- und
Fragmentzwischenbilder wurden dort jedoch nicht getrennt erfasst. Die 43
Erfassungslücken des vorherigen Builds bleiben separat archiviert.

**Eine lückenlose Erfassung aller Zwischenbilder ist damit nicht bestätigt.**
Der strenge Rohbericht behält `renderingCoverageComplete: false` und deshalb
`passed: false`; die vollständig ausgeführten Funktionsprüfungen melden
`functionalPassed: true`. Diese Unterscheidung bleibt erhalten. Die abschließende
Paketprüfung verlangt zusätzlich zur erfolgreichen Bedienung die tatsächliche
Kollision, sichtbare Wolke, bewegte Fragmente, Siegervergrößerung und beide
korrekten jubelnden Mannschaftsfarben in beiden Browserperspektiven auf dem
aktuellen Build. Ein ausgefallenes Zwischenbild wird nicht als erfasst gewertet.

Die vorgesehenen Animationszeiten sind 300 ms Annäherung, 300 ms Aufprall,
350 ms Zerbrechen und 550 ms Siegerhervorhebung. Bei einem Gleichstand folgt
auf den Aufprall ein neutrales Ergebnis. Der anschließende Mannschaftsjubel
hat 776 ms Animationszeit. Ein stark belasteter Browser kann diese Abläufe
langsamer darstellen. Die Prüfung ist kein Bildraten-Benchmark für reale
Handys oder unterschiedliche Grafikkarten.

## 5. Installation und Geltungsbereich

Die lokale Onlineprüfung bestätigt den ausgelieferten Produktionsserver und
zwei echte Spielverbindungen einschließlich Best-of-3, einmaliger Wertung,
wechselndem Startspieler, gemeinsamer Fortsetzung, Wiederbeitritt und neuer Serie.
Ein externer HTTPS-Test oder Containerstart von **0.4.5 auf dem QNAP** ist damit
nicht bestätigt. Nach Übernahme der vollständigen Dateien sind die Schritte
in [QNAP-UPDATE.md](QNAP-UPDATE.md) auszuführen.

Das Paket enthält keine private `.env` und keinen dynv6-Token. Die vorhandenen
lokalen Ordner `skins` und `secrets`, die eigene `.env` und die Caddy-Volumes
bleiben bei der Aktualisierung erhalten. Spielstände und Serien liegen weiterhin
im Arbeitsspeicher; den Server deshalb zwischen zwei Partien aktualisieren.

Weitere Dokumentation: [GRAFIKSETS.md](GRAFIKSETS.md),
[design/ICQ-RETRO.md](design/ICQ-RETRO.md) und
[CHANGELOG.md](CHANGELOG.md).
