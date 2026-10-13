# ICQ Retro – Design der Version 0.4.7

Das Grafikset rekonstruiert das Erscheinungsbild des damaligen taktischen
ICQ-Spiels anhand historischer Aufnahmen. Die Figuren, Kacheln, das Logo und
der Schiedsrichter wurden mit der **integrierten Bildgenerierung** neu erstellt
und zunächst als PNG-Bild-Map eingebunden. Version 0.4.3 ergänzte drei einzeln
gezeichnete Vektorwaffen. Version 0.4.4 führte den vollständigen SVG-Atlas ein.
Version 0.4.7 enthält 43 Motive: beide Teamfarben in Vorder- und Rückenansicht,
zusätzliche Aufdeckposen, vier Schiedsrichter-Farbrichtungen, eine neutrale Pose
und zwei lächelnde Fahnenträger für eine tatsächliche Flaggeneroberung.
Die Fallen sind für beide Spieler wieder goldgelb.
Eine aus derselben SVG exportierte PNG dient als automatische Rückfallgrafik.
Die PNG aus 0.4.3 wird nur noch als Bearbeitungsquelle aufbewahrt.

Die neue Wortmarke lautet **RPS Arena**. Die Lieferung enthält neu erzeugte
Grafiken, keine aus dem Original extrahierten Spieldateien. Sie ist eine visuelle
Annäherung: Aus komprimierten Videoaufnahmen lassen sich nicht alle Details
oder die exakten ursprünglichen Farbwerte zuverlässig bestimmen.

## 1. Verwendete Originalreferenzen

Die Recherche wurde am 11. Oktober 2026 durchgeführt. Die verlinkten
historischen Spielaufnahmen dienten als visuelle Grundlage; aktuelle Remakes
wurden nicht als Beleg für die ursprünglichen Figuren verwendet.

| Quelle | Verwendung |
| --- | --- |
| [Historische Spielaufnahme Q2sDtTbzHiI](https://www.youtube.com/watch?v=Q2sDtTbzHiI) | Gesamtansicht, Brett, Figuren, Logo sowie Waffenwahl |
| [Historische Spielaufnahme KlLij9SlQ9I](https://www.youtube.com/watch?v=KlLij9SlQ9I) | Eigene Figuren von hinten, verdeckte Gegner von vorn, Aufstellung der Falle |
| [PLAYzone: Rückblick auf ICQ-Spiele, 28. Mai 2024](https://www.playzone.cz/clanky/204534-icq-konci-tyto-hry-paril-kazdy-z-nas-ikonicke-pecky-si-muzete-zahrat-i-dnes-vime-kde) | Historische ICQ-Bildcollage, Einordnung des taktischen Spiels und Link zur ersten Aufnahme |
| [Interez: Rückblick auf ICQ-Spiele, 18. November 2016](https://www.interez.sk/slide-lama-zoopaloola-ine-pamatate-sa-este-stare-dobre-icq-hry/) | Zeitlich älterer Kontext zu roten/blauen Teams, Flagge, Falle und geheimen Waffen; Link zu einer weiteren Originalaufnahme |

Für die Bildgenerierung wurden drei tatsächlich visuell geprüfte Standbilder
als Referenz mitgegeben:

- [Gesamtansicht der ersten Aufnahme](https://img.youtube.com/vi/Q2sDtTbzHiI/sddefault.jpg)
- [Waffenwahl der ersten Aufnahme](https://img.youtube.com/vi/Q2sDtTbzHiI/hq2.jpg)
- [Aufstellung der zweiten Aufnahme](https://img.youtube.com/vi/KlLij9SlQ9I/hq1.jpg)

Für die Schiedsrichterkorrektur in 0.4.4 sind zusätzlich die drei vom Nutzer
bereitgestellten Vorlagen maßgeblich: blaue Flagge vorn unten, rote Flagge vorn
oben und beide Flaggen seitlich ausgestreckt. Die neuen Zeichnungen liegen
als bearbeitbare Vektorquelle in `icq-retro-source/referees.svg`.

## 2. Übernommene Gestaltung

| Bereich | Umsetzung |
| --- | --- |
| Spielfeld | Zusammenhängendes, flaches Schachbrett mit sieben Spalten und sechs Reihen |
| Farben | Helles Gelbgrün und kräftiges Limettengrün; grüne Fensterfläche und schmale Kanten |
| Figuren | Sehr große, helle Köpfe, kleine Körper, kurze Gliedmaßen, rote oder blaue Kleidung und dunkle Konturen |
| Teamfarbe | Seat 0 / Raumersteller ist blau, Seat 1 rot; die Zuordnung bleibt in beiden Browsern gleich |
| Eigene Armee | Blaue oder rote Figuren von hinten und unten; noch nicht öffentlich aufgedeckte Werkzeuge bleiben in der bisherigen Haltung hinter dem Rücken |
| Aufgedeckte eigene Kämpfer | Je drei zusätzliche Posen für Blau und Rot mit dem Werkzeug seitlich vor der Figur in einer Hand; Papier und Schere folgen der tiefen Armhaltung der bisherigen Steinfigur |
| Verdeckte Gegner | Vorderansichten in der festen gegnerischen Teamfarbe, ohne Waffenanzeige oder verräterische Unterscheidungsmerkmale |
| Stein | Grauer, rundlicher Stein |
| Papier | Helle Papierrolle mit gerolltem Ende |
| Schere | Lange silberne Klingen mit gelben Griffen |
| Flagge | Kleiner Wimpel an einem Holzstab; Figur oder Sockel folgen der Besitzerfarbe, das Tuch trägt seit 0.4.5 die Gegenfarbe |
| Flaggensieger | Lächelnder Kämpfer von vorn mit erhobener eroberter Flagge; blaues Tuch beim blauen Sieger, rotes beim roten |
| Falle | Für beide Spieler dieselbe goldgelbe gebänderte Figur, jeweils als Vorder- oder Rückenansicht |
| Logo | Große RPS-Buchstaben mit Kopf darüber und dem Namen ARENA darunter |
| Schiedsrichter | Größer in der Statuskarte: vier statische Farb-/Richtungsposen für Blau/Rot oben/unten und eine neutrale Pose mit beiden Flaggen |

Die manifestierten Grundfarben der Brettfelder sind `#C6DE7C` und `#A2C827`.
Die Vektorkacheln besitzen zusätzlich eine leichte Schattierung durch Farbverläufe.
Das neue Layout verwendet Systemschriften und eine schmale Informationsspalte.
Auf kleinen Bildschirmen stehen die Informationen unter dem Brett.

Die heutigen Raum-, Serien- und Bedienfunktionen bleiben Teil der Oberfläche.
Seit 0.4.7 ergänzt ein eigener Raumchat unter dem Spielfeld die Partie. Ein
historischer Countdown wurde weiterhin nicht als Spielfunktion eingeführt.

### Einstieg und Informationsspalte in 0.4.9

Der Einstieg verdeckt die gesamte Ansicht mit einer undurchsichtigen Fläche.
Nach dem Raumeintritt steht das Logo oben links. Angelehnt an die schmale
Informationsspalte der Originalaufnahme stehen Status und ein kleiner
Punktestand rechts neben dem Brett, gefolgt vom Schiedsrichter und den
phasenabhängigen Aktionen. Auf schmalen Bildschirmen stehen Status und Punkte
über dem Brett. Die zusätzliche Brettüberschrift entfällt; Seriendetails sind
aufklappbar. Der große Lobbybutton fragt vor dem Verlassen nach und warnt bei
einer laufenden Partie vor dem Abbruch und dem Sieg des Gegners.

### Korrektur in 0.4.2

Die aufgedeckte blaue Steinfigur unten links dient als gemeinsame Vorlage für
alle drei aufgedeckten eigenen Kämpfer. Papier und Schere übernehmen Körper,
Kopf, Beine sowie die niedrige Arm- und Handhaltung dieser Vorlage. Die
jeweiligen Werkzeuge werden hinter dem vorderen blauen Ärmel und der greifenden
Hand eingesetzt. Der Werkzeugwechsel erfordert damit keine andere Armhaltung.

### Einzelwaffen und Schärfe in 0.4.3

Die Regelerklärung und die geheime Auswahl im Duell zeigen jetzt ausschließlich
das jeweilige Werkzeug: einen grauen rundlichen Stein, eine helle Papierrolle
mit gerollten Enden und eine silberne Schere mit gelben Griffen. Dunkle Konturen,
helle Flächen und zurückhaltende Schattierungen übernehmen die Retro-Optik.
Die Figuren des Bretts behalten ihre bisherigen Bilder.

Die drei klar umrissenen Motive wurden direkt als Pfade und Formen in
`weapon-atlas.svg` gezeichnet. Diese Datei enthält keine eingebettete PNG.
In 0.4.3 blieben die übrigen Motive noch Rasterbilder; die Waffenquelle ist
weiterhin als bearbeitbare Vorlage enthalten.

### Retro-Oberfläche in 0.4.3

Der Schiedsrichter erscheint im Raum direkt in der Statuskarte. Während eines
laufenden Zugs ersetzt sein Bild die sichtbare textliche Zugüberschrift;
Aufstellung, Duell, Pause und Spielende behalten ihre passenden Überschriften
und Bedienelemente. Das große Logo bleibt im Kopfbereich. Vor dem Raumbeitritt
steht der neutrale Schiedsrichter weiterhin neben dem Logo. Die Flaggen- und
Siegerzuordnung folgt dem bestätigten Spielstand; ohne verwendbares Porträt
bleibt die textliche Anzeige erhalten.

Im Designmenü wird die aktive Option dunkelolivgrün mit heller Schrift
hinterlegt. Die weiteren Optionen verwenden dunkle Schrift auf hellem
Hintergrund. Die zusätzlichen gelben Aufdeckpunkte auf den Figuren entfallen
im Retro-Design; die vorgesehenen Aufdeckposen übernehmen die Darstellung.

### Vollständiger Vektoratlas in 0.4.4

Alle 39 Motive liegen jetzt in `atlas.svg` auf einer Zeichenfläche von
1728 × 2016. Die bisherigen Figurenkonturen werden aus der PNG-Vorlage in
Pfade übertragen, die Schattierungen als Farbflächen angenähert. Aus denselben
Konturen entstehen beide Teamfarben für die jeweilige Blickrichtung.
Brettkacheln, Logo und Schiedsrichter verwenden auch native Vektorverläufe.
Die drei Schiedsrichterposen sind nach den neuen Nutzerreferenzen gezeichnet;
die vorhandenen Einzelwaffen werden direkt aus ihrer Vektorquelle übernommen.
Der Vollatlas enthält keine eingebetteten Rasterbilder.

Die Vektorisierung überträgt die vorhandene Gestaltung in skalierbare Konturen
und Farbflächen. Details des historischen Originals bleiben eine Annäherung.
Der neue Atlas wird vollständig neu angeordnet. Die PNG-Rückfallgrafik wird
aus dieser fertigen SVG exportiert und zeigt dieselben 39 Motive mit denselben
Maßen und Frame-Koordinaten. Die PNG aus 0.4.3 liegt ausschließlich als
Bearbeitungsquelle unter `design/icq-retro-source/original.png`.

### Gelbe Fallen und Schiedsrichterrichtungen in 0.4.5

Die Zielflaggen sind in allen vier Figurenansichten ebenfalls angepasst:
Die blaue Mannschaft trägt ein rotes Flaggentuch, die rote ein blaues.
Der Körper beziehungsweise Sockel behält die Besitzerfarbe. Nur die
Zielflaggen werden getauscht; die Schiedsrichterflaggen zeigen unverändert
die Farbe des Spielers am Zug beziehungsweise des Siegers.

Die goldgelben Farben der ursprünglichen Fallen werden für beide Besitzer
wieder unverändert übernommen. Vorder- und Rückenansicht bleiben getrennt;
pro Ansicht zeigen der blaue und rote Farbslot dieselbe gelbe Grafik.

Zur bisherigen blauen Unten-Pose und roten Oben-Pose kommen eine blaue
Oben-Pose und eine rote Unten-Pose hinzu. Dafür werden ausschließlich die
beiden Flaggenfarben in den nativen Zeichnungen getauscht; Körper und
Armhaltung bleiben erhalten. Beide Flaggen sind in jeder Pose vorhanden.
Die neutrale Zeichnung bleibt unverändert.

Die zwei neuen Motive nutzen freie Plätze im bestehenden Raster. Der Atlas
enthält nun 41 Motive, die 39 bisherigen Rechtecke behalten ihre Koordinaten.
SVG, PNG und Manifest werden gemeinsam erzeugt. Die größere Darstellung im
Spiel verwendet 180 × 135 statt 136 × 102 Pixel.

### Flaggensieger und Raumchat in 0.4.7

Zwei native SVG-Zeichnungen zeigen den erfolgreichen Flaggeneroberer lächelnd
mit erhobener Fahne. Beide Browser sehen ihn von vorn. Das Tuch entspricht
der tatsächlich eroberten gegnerischen Zielflagge: Der blaue Spieler erobert
das blaue Tuch der roten Mannschaft; der rote Spieler erobert das rote Tuch
der blauen. Die vier regulären Flaggenansichten behalten ihre bisherige Zuordnung.

Bei einer Flaggeneroberung springen alle verbliebenen Figuren der Gewinnerarmee
viermal gemeinsam. Anschließend bleibt der Fahnenträger am Zielfeld in seiner
Siegerpose stehen. Ohne Animationen oder bei reduzierter Bewegung erscheint
die Pose statisch. Andere Sieggründe verwenden den bisherigen Jubel.

Der Atlas wächst auf 2016 × 2016 mit 43 Motiven; die bisherigen 41 Rechtecke
behalten ihre Positionen. Die bearbeitbaren neuen Zeichnungen liegen in
`icq-retro-source/flag-victory.svg`, die Zuordnung im Manifest unter
`flagVictoryFrames.blue/red`. Die PNG wird aus demselben Vollatlas neu exportiert.

Der Chat erscheint ausschließlich im Raum unter dem Spielfeld und verwendet
die festen Teamfarben für die Spielernamen. Nachrichten werden per Enter oder
**Senden** übertragen. Der Server hält die letzten 50 Nachrichten mit höchstens
300 Unicode-Zeichen je Nachricht bis zum Raumende im Arbeitsspeicher. Der Verlauf
bleibt über Partiewechsel und Wiederverbindung erhalten; Sendefehler lassen den
Entwurf stehen. Bei einem Serverneustart geht der Raumverlauf verloren.

## 3. Tatsächlich gelieferte Bild-Map

| Datei | Inhalt |
| --- | --- |
| `public/skins/icq-retro/atlas.svg` | Primärer Atlas mit 43 Vektormotiven auf einer Zeichenfläche von 2016 × 2016 |
| `public/skins/icq-retro/atlas.png` | Frisch aus derselben SVG exportierte Rückfallgrafik; 2016 × 2016 Pixel mit RGBA-Transparenz |
| `public/skins/icq-retro/weapon-atlas.svg` | Bearbeitbare Waffenquelle mit 960 × 320 Einheiten; wird im Retro-Set nicht separat geladen |
| `public/skins/icq-retro/skin.json` | 43 gemeinsame Frame-Rechtecke für SVG und PNG, Besitzerfarben, Blickrichtungen, Waffen, Flaggensieger und Präsentation |
| `design/icq-retro-source/original.png` | PNG aus 0.4.3 als Bearbeitungsvorlage |
| `design/icq-retro-source/layout.json` | Ausschnittplan der alten Vorlage mit 1121 × 1787 Pixeln |
| `design/icq-retro-source/referees.svg` | Vier Farb-/Richtungsposen und eine neutrale Schiedsrichterzeichnung |
| `design/icq-retro-source/flag-victory.svg` | Zwei native Siegerzeichnungen mit eroberter Flagge; je benanntes Motiv lokal 320 × 320 Einheiten |
| `scripts/build-retro-atlas.py` | Optionaler gemeinsamer Neubau von SVG, PNG und Grafikmanifest |
| `scripts/retro_vectorize.py` | Übertragung der Figurenkonturen in Pfade mit Pillow und libpotrace |
| `scripts/build-retro-weapons.mjs` | Kompatibler Aufruf des vollständigen Python-Grafikbuilds |
| `public/skins/index.json` | Katalog mit ICQ Retro als Vorgabe sowie Klassisch und Arcade |
| `client/retro.css` | Zur Bild-Map passende Oberflächengestaltung |

Die in Version 0.4.0 erzeugte Bild-Map wurde bis 0.4.2 durch gezielte Aufträge
an die integrierte Bildgenerierung überarbeitet und erweitert. Version 0.4.3
bewahrte diesen 1121 × 1403 großen Bereich und ergänzte darunter drei einzelne
Waffen. In Version 0.4.4 wird dieser Stand zur Bearbeitungsquelle für den
erweiterten Vektoratlas; die Laufzeit-PNG entsteht aus dessen SVG neu.

Die aktuellen Rechtecke stehen in `skin.json`. Die bisherigen 41 Motive behalten
ihr Raster mit sechs Spalten und sieben Reihen bei 288 Einheiten Abstand. Die
größere Zeichenfläche ergänzt rechts eine siebte Spalte. Die
Motive werden proportional in maximal 272 × 272 große Bereiche eingepasst;
die Frame-Rechtecke haben deshalb unterschiedliche Breiten und Höhen. Die
drei bisherigen Schiedsrichter stehen in der sechsten Reihe, die Waffen
und die beiden zusätzlichen Farbrichtungen in der siebten Reihe. Der blaue
Flaggensieger ergänzt den freien Platz rechts daneben; der rote steht oben
in der neuen siebten Spalte.

Für die blauen Kämpfer ist die natürliche, tiefe Armhaltung der bereits
akzeptierten Steinfigur maßgeblich. Papier und Schere liegen vor oder seitlich
am Oberkörper und dürfen teilweise von Kopf, Körper oder Hand überdeckt sein.
In den Rückenansichten beider Farben liegen der kurze Ärmel und die greifende
Hand vor dem Werkzeug und verdecken dessen Rand. Die Motive besitzen getrennte
Bildbereiche mit transparentem Abstand.
Bei diesen regulären Aufdeckfiguren ist ein hochgehobener Arm oder ein über dem
Kopf gehaltenes Werkzeug nicht vorgesehen. Diese Festlegung übernimmt die
Nutzerkorrektur für die Waffenhaltung. Die neue Flaggensiegerpose hebt dagegen
gezielt die eroberte Fahne.

| Gruppe | Frame-Namen | Anzahl |
| --- | --- | ---: |
| Blaue Rückenansichten | `blue-back-rock`, `blue-back-paper`, `blue-back-scissors`, `blue-back-flag`, `blue-back-trap`, `blue-back-unknown` | 6 |
| Blaue Vorderansichten | `blue-front-rock`, `blue-front-paper`, `blue-front-scissors`, `blue-front-flag`, `blue-front-trap`, `blue-front-unknown` | 6 |
| Rote Rückenansichten | `red-back-rock`, `red-back-paper`, `red-back-scissors`, `red-back-flag`, `red-back-trap`, `red-back-unknown` | 6 |
| Rote Vorderansichten | `red-front-rock`, `red-front-paper`, `red-front-scissors`, `red-front-flag`, `red-front-trap`, `red-front-unknown` | 6 |
| Aufgedeckte Kämpfer beider Farben | `blue-back-<waffe>-revealed`, `red-back-<waffe>-revealed` für `rock`, `paper`, `scissors` | 6 |
| Brett | `board-light`, `board-dark` | 2 |
| Logo und neutraler Schiedsrichter | `logo`, `referee-neutral` | 2 |
| Zugposen des Schiedsrichters | `referee-blue-turn`, `referee-red-turn`, `referee-blue-top`, `referee-red-bottom` | 4 |
| Einzelne Waffen | `weapon-rock`, `weapon-paper`, `weapon-scissors` | 3 |
| Flaggensieger | `blue-front-flag-victory`, `red-front-flag-victory` | 2 |

Die genauen Koordinaten stehen direkt in `skin.json`; die Motive bilden keine
gleichmäßig zugeschnittenen Kacheln. Eine spätere Änderung der Bildgröße oder
Motivpositionen erfordert entsprechend aktualisierte Rechtecke.

Die beiden neuen Siegerbilder sind jeweils 272 × 272 Einheiten groß:

| Frame | Ursprung in SVG und PNG |
| --- | --- |
| `blue-front-flag-victory` | x = 1448, y = 1736 |
| `red-front-flag-victory` | x = 1736, y = 8 |

Die Waffen verwenden im vollständigen SVG-Atlas und der PNG dieselben Namen
und Koordinaten. Ihre separate bearbeitbare Quelle hat eine eigene Anordnung.
Im Hauptatlas sind die drei Ausschnitte jeweils 272 × 272 groß; die
bearbeitbare Waffenquelle behält ihre drei 320 × 320 großen Felder:

| Frame | Ursprung in `atlas.svg` und `atlas.png` | Ursprung in der Waffenquelle `weapon-atlas.svg` |
| --- | --- | --- |
| `weapon-rock` | x = 8, y = 1736 | x = 0, y = 0 |
| `weapon-paper` | x = 296, y = 1736 | x = 320, y = 0 |
| `weapon-scissors` | x = 584, y = 1736 | x = 640, y = 0 |

`weapons` verweist weiterhin auf die Frames im Hauptatlas. Dessen
`atlas.image` ist jetzt `atlas.svg`; `atlas.fallbackImage` verweist auf
`atlas.png`. Der gesonderte `weaponAtlas`-Eintrag entfällt im Retro-Manifest.
Eigene Sets mit separatem Waffenatlas bleiben unterstützt.

Die Oberfläche lädt die SVG als Bild und zeigt ihre Ausschnitte über
CSS-Hintergründe an; es wird kein SVG-`<use>`-Sprite in das Dokument eingebunden.
Das Brett rendert die Vektorquelle für seine Textur bei Bedarf mit höherer
Auflösung. Kann der primäre Atlas nicht verwendet werden, übernimmt die PNG
mit denselben Frames die Darstellung aller Motive.

## 4. Darstellung aus dem bestätigten Spielstand

`teamPieces.<farbe>.own.<werkzeug>.revealed.frame` verweist auf die zusätzliche Pose.
Die Auswahl folgt ausschließlich dem aktuellen öffentlichen `piece.revealed`
und dem bekannten Werkzeugtyp. Sie hängt weder von einer abgespielten Animation
noch von einer früheren Kampfmeldung ab. Dadurch erscheint sie auch nach einem
Wiederbeitritt sofort richtig. Eine neue Partie beginnt wieder mit den
Basisposen. Spielfeld und Kampfergebnisleiste verwenden dieselbe Auswahl.
Fehlt die optionale Variante in einem eigenen Grafikset, bleibt dessen
Basisgrafik verwendbar. Unbekannte Gegner werden dadurch nicht aufgedeckt.
Bei `presentation: "retro"` wird kein zusätzlicher gelber Aufdeckpunkt gezeichnet.
`piece.revealed` und die Auswahl der Aufdeckpose bleiben davon unabhängig;
andere Darstellungen verwenden ihre bisherigen Aufdeckmarker.

Die Besitzerfarbe folgt dem öffentlichen Spieler-Seat: **Seat 0 ist blau,
Seat 1 rot**. Diese Zuordnung gilt in beiden Browsern für Figuren, Namen,
Spielstand, Zug-/Siegeranzeigen und Schiedsrichter. `teamPieces.blue` und
`.red` legen die Farbe fest; die darunterliegenden `own`- und `enemy`-Einträge
bestimmen nur die Ansicht. Eigene Figuren stehen unten in der Rückenansicht,
gegnerische oben in der Vorderansicht. Die unbekannten Vorderansichten zeigen
weiterhin keine Waffe. Die Zielflaggentücher tragen die Gegenfarbe (Blau erhält
Rot, Rot erhält Blau); die Figuren darunter behalten die Besitzerfarbe.
Die Fallen sind für beide Besitzer goldgelb.

`flagVictoryFrames.<farbe>` ist eine optionale Ausnahme von der normalen
Figurenansicht. Sie wird nur für den überlebenden Eroberer einer durch das
öffentliche Schlussereignis bestätigten Flagge verwendet. Sieger, Figur und
Zielfeld müssen zum beendeten Spielstand passen. Die beiden Retro-Frames zeigen
in beiden Browsern eine Vorderansicht. Die Pose bleibt am Partieende und nach
Wiederverbindung sichtbar; eine neue Aufstellung verwendet wieder die normalen
Figuren. Fehlt der Eintrag, bleibt die reguläre Darstellung erhalten. Ein
Sieg durch Aufgabe oder fehlende legale Züge setzt keine Flaggenpose.

`directionalTurnPortraits.<farbe>.<top|bottom>` wählt die Schiedsrichterpose.
Die Richtung folgt der Seite im aktuellen Browser: eigene Seite unten,
gegnerische Seite oben. Die Besitzerfarbe bleibt in beiden Ansichten gleich.

| Spielstand | Eigener Browser des aktiven Spielers | Gegnerischer Browser |
| --- | --- | --- |
| Zug von Seat 0 | `referee-blue-turn`: Blau unten | `referee-blue-top`: Blau oben |
| Zug von Seat 1 | `referee-red-bottom`: Rot unten | `referee-red-turn`: Rot oben |
| Pause während eines Zugs | Gleiche Farbe/Richtung, mit Pausentext | Gleiche Farbe/Richtung, mit Pausentext |
| Partie mit Sieger | Gewinnerfarbe unten | Gewinnerfarbe oben |
| Lobby, Warten, Aufstellung, gleiche Werkzeuge oder Remis | Neutrale Pose | Neutrale Pose |

Die neutrale Pose verwendet `portrait`. Fehlt eine Farbrichtung, versucht die
Anzeige `colorTurnPortraits.<farbe>`, dann den kompatiblen alten Slot
`turnPortraits.own` für Blau beziehungsweise `.enemy` für Rot und schließlich
das neutrale Porträt. Für Figuren gelten die bisherigen `pieces.own`- und
`pieces.enemy`-Einträge ebenfalls als feste blaue beziehungsweise rote
Farbvarianten, wenn passende `teamPieces` fehlen. Der Text beschreibt den
aktuellen Zustand weiterhin. Nach einem Sieg behauptet die
Beschriftung nicht mehr, jemand sei am Zug.

Die Einzelwaffen verwendet `weaponIcon` für die drei Regelkarten, die zentrale
Waffenwahl und die Kampfanimation. Die längere Bildkante misst in den Regeln
44 CSS-Pixel, in der Waffenwahl 88 (bei schmalem Brett 64) und im Kampf 104
(bei schmalem Brett rund 81) CSS-Pixel. Dieselbe zentrale Auswahl erscheint
nach jedem weiteren Waffengleichstand unter „Wähle deine Waffe“.
Andere Figurenanzeigen verwenden die passenden Ausschnitte für Besitzerfarbe
und Blickrichtung. Sets ohne `weapons` behalten in Regeln und Duell ihre
Figurensymbole in der eigenen festen Teamfarbe.

Die Overlays liegen genau über dem Brett. Seit 0.4.6 bündelt ein gemeinsames
hellolives Panel alle Elemente der jeweiligen Waffenwahl oder Kampfdarstellung.
Seine Hintergrundfarbe ist rund 92 Prozent deckend; außerhalb des Panels bleibt
das Brett unverdeckt sichtbar. Die Transparenz gilt ausschließlich für die
Hintergrundfarbe. Waffen, Texte und Bedienelemente bleiben vollständig deckend,
auch nach der bestätigten Auswahl. Überschrift, Rollen, Spielernamen und Status
haben keine eigenen Hintergrundkacheln mehr. Die Waffenbuttons bleiben dezent
konturiert; Auswahl und Tastaturfokus verwenden die feste Teamfarbe. Auf schmalen
Brettern sinken die Panelabstände, die großen Waffenbilder bleiben erhalten.
Auch bei reduzierter Bewegung bleibt die statische Verliererwaffe deckend und
wird durch Graustufen und „Besiegt“ gekennzeichnet. Die Kampfanimation bewegt die
beiden bereits öffentlich aufgedeckten Waffen zur Mitte, zeigt eine native
SVG-Kampfwolke und zerlegt die Verliererwaffe in sechs maskierte Bildteile.
Die vier Phasen dauern in v0.4.7 nominell 600, 600, 700 und 1100 Millisekunden,
zusammen 3 Sekunden; vor dem Kampf liegen nach einer bestätigten Waffenwahl
600 Millisekunden Pause. Klassisch und Arcade verwenden für denselben
Overlaygrund 85 Prozent Deckkraft, während Retro seine 92 Prozent behält.

Der Sieger pulsiert; anschließend springen alle verbliebenen Figuren seines
Teams auf ihren unveränderten Feldern. Bei der Flaggeneroberung sind es vier
synchrone Sprünge in 1680 Millisekunden, bei normalen Kampfgewinnen bleibt der
bisherige kurze Jubel. Die Bewegung entsteht in der Oberfläche beziehungsweise
im Brett-Renderer; die neuen Fahnenträger verwenden dabei ihre statischen
Atlasmotive. Die gleiche Darstellung funktioniert mit dem PNG-Rückfall.
Ohne Animationen oder bei reduzierter Bewegung bleibt das Kampfergebnis
350 Millisekunden statisch sichtbar und die Flaggensiegerpose anschließend stehen.

Das Brett berücksichtigt beim Erstellen die Bildschirmdichte, auf Viertelschritte
aufgerundet und auf Faktor 2 begrenzt. Die logischen Brettkoordinaten bleiben
680 × 616. Bei DPR 2 und 3 wird in einen 1360 × 1232 Pixel großen Puffer gezeichnet;
die sichtbare Größe richtet sich weiterhin nach dem verfügbaren Platz. Das
unterstützt die Darstellung von Figuren, Markierungen und Text. Für den
Vektor-Hauptatlas wird die SVG bei der Texturerzeugung passend gerendert;
bei einem PNG-Rückfall stehen die Details der Rastervorlage zur Verfügung.
Die Pixeldichte wird beim Start ermittelt; für einen Monitorwechsel mit anderer
Dichte die Spielseite neu laden.

## 5. Bildprompts, Vektorquellen und spätere Animationen

Die vollständigen tatsächlich verwendeten englischen Aufträge liegen bei:

- [Erster Generierungsauftrag](icq-retro-image-prompt.txt)
- [Gezielter Überarbeitungsauftrag](icq-retro-image-cleanup-prompt.txt)
- [Erweiterung um aufgedeckte eigene Figuren](icq-retro-revealed-prompt.txt)
- [Erste Armkorrektur und zusätzliche Schiedsrichterposen](icq-retro-revealed-correction-prompt.txt)
- [Korrektur der Schulter- und Ellenbogenposition](icq-retro-arm-position-prompt.txt)
- [Feste Flaggenhände und rote Figuren als Armvorlage](icq-retro-referee-hands-prompt.txt)
- [Gezielte Korrektur der neutralen und blauen Flaggenpose](icq-retro-referee-final-correction-prompt.txt)
- [Tiefe Armhaltung der blauen Steinfigur für Papier und Schere](icq-retro-rock-pose-prompt.txt)
- [Getrennte Ausschnitte für Logo und neutralen Schiedsrichter](icq-retro-atlas-spacing-prompt.txt)
- [Blauer Ärmel vor dem Werkzeug und Abstand des Schiedsrichters](icq-retro-foreground-arm-prompt.txt)
- [Gemeinsame blaue Steinfigur als Vorlage, nur das Werkzeug wechseln](icq-retro-identical-blue-figures-prompt.txt)
- [Inaktive rote Flagge des Schiedsrichters erhalten](icq-retro-preserve-referee-flag-prompt.txt)
- [Flaggendetail bei sauberer Transparenz wiederherstellen](icq-retro-preserve-referee-flag-retry-prompt.txt)
- [Schiedsrichterposen aus der bisherigen Bildvorlage übernehmen](icq-retro-referees-from-reference-prompt.txt)

Die drei Einzelwaffen sind direkt in
[`weapon-atlas.svg`](../public/skins/icq-retro/weapon-atlas.svg) gezeichnet.
[`scripts/build-retro-atlas.py`](../scripts/build-retro-atlas.py) überträgt die
Figuren mithilfe von [`scripts/retro_vectorize.py`](../scripts/retro_vectorize.py)
aus `icq-retro-source/original.png` und dessen `layout.json` in Pfade.
Der Build übernimmt die Waffenquelle, die Schiedsrichter aus
[`icq-retro-source/referees.svg`](icq-retro-source/referees.svg) und die Flaggensieger aus
[`icq-retro-source/flag-victory.svg`](icq-retro-source/flag-victory.svg) und erzeugt
**SVG, PNG und `skin.json` gemeinsam**. Die PNG wird aus der vollständigen SVG
exportiert. Dieser optionale Arbeitsweg benötigt Python 3 mit **Pillow**,
die Systembibliothek **libpotrace** und **Inkscape** für den PNG-Export.

Nach einer Änderung der Figuren-, Waffen-, Schiedsrichter- oder Siegerquelle wird
derselbe vollständige Build ausgeführt. Der frühere Aufruf
[`scripts/build-retro-weapons.mjs`](../scripts/build-retro-weapons.mjs) ist ein
Kompatibilitätseinstieg und startet jetzt ebenfalls den Pythonbuild. Der
normale Spielbuild verwendet die fertigen SVG-/PNG-Dateien und benötigt keine
dieser Grafikwerkzeuge. Der Bearbeitungsablauf steht in
[GRAFIKSETS.md](../GRAFIKSETS.md).

Alle 24 Basisfiguren, sechs zusätzlichen Aufdeckposen, fünf Schiedsrichterposen,
drei Einzelwaffen und zwei Flaggensieger verwenden **statische Frames**.
Es gibt in diesem Set noch keine neu gezeichneten Bildfolgen für Gehen,
Angriff, Sieg, Niederlage oder den Schiedsrichter. Auch die vier Sprünge beim
Flaggensieg bewegen das jeweilige statische Motiv. Die bereits vorhandenen
allgemeinen Zug- und Kampfeffekte sowie die Option „Animationen“ funktionieren
weiterhin. Arcade verwendet jetzt ebenfalls seine SVG als primäres Bild mit
PNG-Rückfall; seine 147 Frames und vorhandenen Animationsclips bleiben erhalten.

Für den folgenden Animationsauftrag kann das bestehende Grafikset-Format
um Bildfolgen ergänzt werden. Seine sieben Figuren-Zustände sind bereits
vorbereitet: `idle`, `selected`, `move`, `duel`, `attack`, `win` und `lose`.
Format und Beispiele stehen in [GRAFIKSETS.md](../GRAFIKSETS.md).

## 6. Auswahl und eigene Anpassungen

Ohne gespeicherte Browserpräferenz erscheint ICQ Retro automatisch. Bei einer
bestehenden Auswahl lässt es sich unter **Design → ICQ Retro** auswählen.

Für Änderungen auf dem QNAP können eigene Dateien unter `skins/icq-retro/`
die gleichnamigen eingebauten Dateien ersetzen. Der Atlas bleibt damit
unabhängig vom Spielcode austauschbar. Ein eigener `skins/index.json` ersetzt
den eingebauten Katalog und muss den Eintrag für ICQ Retro enthalten, wenn
dieses Design auswählbar sein soll. Die genaue Anleitung steht in
[GRAFIKSETS.md](../GRAFIKSETS.md).
