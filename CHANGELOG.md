# Änderungen

## 0.4.14

- ICQ Retro Dark mit dunkler Seitenpalette und gemeinsam genutzten ICQ-Retro-Atlanten; optionales, auf lokale Grafikset-IDs begrenztes `assetPack` im Manifest.
- Nur Gegnernachrichten erzeugen Sprechblasen. Textlänge bestimmt die Anzeigezeit zwischen 5 und 15 Sekunden; Klick führt nach dem Ausblenden zum Chat. Eine neue Gegnernachricht startet die Anzeigezeit neu.
- Native Touch-Pointer-Verarbeitung wählt Figuren mit einem Tipp, unabhängig vom schlafenden Phaser-Renderloop; Scrollgesten und abgebrochene Berührungen wählen keine Figur aus.
- Mobile Kopfzeile mit Spielernamen und Punkten beiderseits des Schiedsrichters und aktuellem Zughinweis.
- Vollständige mobile Kampfanimationen einschließlich Zusammenstoß, Zerfall und Siegeranimation bei aktivierter Bewegung.

## 0.4.13

- Designauswahl mit großen Figurenvorschauen nebeneinander im unteren Loginbereich.
- Rechtliche Links in gleicher Schriftgröße neben dem Remake-Hinweis am unteren Spielrand; während der Partie sichtbar.
- Einheitlicher Klapppfeil für alle Akkordeons und eckige Retro-Bereiche.
- Größere, kräftigere Chattexte auf dezent nach Spielerfarbe getönten Zeilen.
- Sprechblasen über dem Spielfeld beim jeweiligen Absender, mit direktem Text bei höchstens fünf Wörtern und 50 Unicode-Zeichen; längere Texte behalten das Atlasmotiv. Klick blendet die Blase aus. Historische Nachrichten erzeugen beim Raumeintritt keine Blase.

## 0.4.12

- Nachrichtenhinweis beim Schiedsrichter bleibt bis zum Klick oder einer eigenen gesendeten Nachricht sichtbar; Klick springt zum Chat, ein Chat-Button zurück zum Spielfeld.
- Eigene Sprechblasenmotive für Klassisch, Arcade und ICQ Retro in den SVG-Atlanten sowie passenden Raster- und Mobilvarianten; Spielstatus zeigt seinen Klappzustand.
- Fußbereich unter dem Raumchat mit zusätzlichem Abstand zum Rand und Links zu Copyright und Impressum; dieselben Links sind in der Lobby erreichbar.
- Separate Copyright- und Impressumsseiten mit gekennzeichneten Platzhaltern für die noch fehlenden Angaben.

## 0.4.11

- Login zeigt die Version klein oben rechts; automatische Scrollaktionen entfernt.
- Spielstatus aufklappbar mit festen Seriendetails und Figurenanzahlen.
- Ereigniszeile unter dem Spielfeld entfernt, Punktestand auf Spielfeldbreite begrenzt.
- „Partie aufgeben“ als großer Button passend zu „Zur Lobby“.

## 0.4.10

- Raumeintritt scrollt zum Seitenanfang mit sichtbarem Logo.
- Punktestand mit größeren Namen und Zahlen neben dem Logo; Spielstatus unverändert.
- Mausrad über dem Spielfeld freigegeben und „Zwei Teams. Ein Ziel.“ entfernt.
- Chat-Eingabe über dem Verlauf, neueste Nachrichten zuerst und zweisekündige
  Gegnernachrichten-Anzeige beim Schiri in den Designfarben.

## 0.4.9

- Undurchsichtiger, vollflächiger Einstieg; das Retro-Logo erscheint nach dem
  Raumeintritt oben links.
- Brettüberschrift entfernt; Spielstatus und kompakter Punktestand stehen in
  der Informationsspalte, mobil über dem Brett. Seriendetails sind aufklappbar.
- Größerer „Zur Lobby“-Button mit Ausgangssymbol und einer kurzen Bestätigung
  vor dem Verlassen. Laufende Partien weisen auf Abbruch und Gegnersieg hin.
- Ladebildschirm bereits im initialen HTML; der klassische Einstieg blitzt vor
  dem Laden des Standarddesigns ICQ Retro nicht mehr auf.
- Arena erst nach geladenen und dekodierten Atlasbildern, bereitgestellter
  Spielfeldszene und einem Renderdurchlauf freigeben; anschließend Tastaturfokus
  auf den Einstieg beziehungsweise das wiederverbundene Spielfeld setzen.
- Gespeicherte Designauswahl und Ersatzdesign bei Ladefehlern bleiben verfügbar.

## 0.4.8

- Zentraler Einstieg mit Logo, Spielername und Raumaktionen auf einem gemeinsamen
  leicht transparenten Overlay über dem Spielfeld.
- Name vor der Raumwahl; bei Einladungslinks steht Beitreten vor Erstellen.
  Der Spielmodus gilt nur für neu erstellte Räume.
- Einstieg verschwindet beim Raumeintritt; Raumdetails, Verlauf und Regeln sind
  einklappbar. Einladung bleibt während der Aufstellung direkt sichtbar.
- Responsive Darstellung, Fehler direkt im Einstieg und erhaltener Tastaturfokus.

## 0.4.7

### Flaggensieger und langsamere Kampfpräsentation

- ICQ Retro erhält zwei native SVG-Frontposen für den tatsächlichen Eroberer
  einer gegnerischen Flagge. Der Kämpfer lächelt und hält das eroberte Tuch
  erhoben; beide Browser zeigen dieselbe Vorderansicht in seiner festen Teamfarbe.
  Die seit 0.4.5 getauschten Zielflaggen bleiben unverändert: Der blaue Sieger
  erobert ein blaues Tuch, der rote ein rotes.
- Bei einem Flaggensieg springen alle verbliebenen Figuren der Gewinnerarmee
  viermal gemeinsam. Der Fahnenträger bleibt danach am Zielfeld in seiner
  Siegerpose. Ohne Animationen oder bei reduzierter Bewegung erscheint diese
  Pose statisch. Normale Kampf- und Aufgabensiege behalten den bisherigen Jubel.
- `flagVictoryFrames.blue/red` ist eine optionale Zuordnung im Grafikset.
  Sie gilt ausschließlich für den durch den öffentlichen Spielstand bestätigten
  Flaggeneroberer. Ohne passende Siegergrafik bleibt die reguläre Figur nutzbar.
- Der Retro-Atlas wächst auf 43 Motive und 2016 × 2016 Einheiten. Die bisherigen
  41 Ausschnittkoordinaten bleiben erhalten. SVG, daraus exportierte PNG und
  Manifest werden gemeinsam erzeugt; `design/icq-retro-source/flag-victory.svg`
  enthält die bearbeitbaren neuen Posen.
- Der Atlasexport prüft die vollständige PNG vor dem Schreiben und ersetzt die
  fertigen Grafikdateien atomar. Dadurch bleibt während eines Exports keine
  nur teilweise geschriebene Atlasdatei sichtbar.
- Die vier Kampfphasen dauern nominell 600/600/700/1100 Millisekunden, insgesamt
  3000 Millisekunden. Nach bestätigter Waffenwahl folgt eine Pause von 600
  Millisekunden bis zum Kampf. Ohne Animationen oder bei reduzierter Bewegung
  bleibt das Ergebnis 350 Millisekunden statisch sichtbar.
- Der gemeinsame Overlaygrund ist in Klassisch und Arcade zu 85 Prozent
  deckend, im Retro-Design weiterhin zu 92 Prozent. Waffen, Texte und
  Bedienelemente bleiben vollständig deckend.

### Raumchat

- Unter dem Spielfeld erscheint im Raum eine gemeinsame Nachrichtenliste mit
  Eingabe und Senden-Schaltfläche. Enter sendet ebenfalls. Namen verwenden die
  feste Teamfarbe des jeweiligen Spielers.
- Der Server akzeptiert nichtleere, bereinigte Textnachrichten mit maximal 300
  Unicode-Zeichen und mindestens 500 Millisekunden Abstand je Spieler. Er setzt
  Namen, Seat, Spieler-ID, Zeit und fortlaufende Nachrichten-ID selbst.
- Die letzten 50 Nachrichten bleiben im Arbeitsspeicher desselben Raums über
  Partien, Serien und Wiederverbindungen erhalten. Ein neuer Raum startet leer;
  bei Raumende oder Serverneustart geht der Verlauf verloren.
- `chat_send`, `chat` und `chat_problem` bilden einen getrennten Nachrichtenkanal.
  Spielrevision, letzte Aktion und geheime Duellwahlen bleiben unberührt.
  Wiederholte Kennungen desselben Spielers werden innerhalb des behaltenen
  Verlaufs bestätigt, ohne eine zweite Nachricht zu erzeugen.
- Sendefehler erhalten den Entwurf. Die Wiederverbindung übernimmt den Verlauf
  des bisherigen Raums. Ein verbundener Teilnehmer kann auch bei pausiertem
  Gegner oder nach Partieende schreiben; nach der terminalen Servermeldung
  werden keine Nachrichten mehr angenommen.

### Lieferung

- Vollständige Lieferung und aktuelle Update-Anleitungen auf **0.4.7** mit
  `RPS-Arena-v0.4.7-komplett.zip`. Der QNAP-Neubau verwendet weiterhin den
  vollständigen Quellstand und `--build --wait`; vorhandene HTTPS-Konfiguration,
  eigene Grafiksets, Umgebungswerte, Token und Zertifikats-Volumes bleiben erhalten.
- Der endgültige Prüfstand steht in `PRUEFBERICHT.md`.

## 0.4.6

### Zusammenhängende Flächen für Waffenwahl und Gefecht

- Beide Overlays verwenden jeweils ein gemeinsames Panel mit rund 92 Prozent
  deckender Hintergrundfarbe. Im Retro-Design ist diese Fläche helloliv.
  Überschrift, Rollen, Spielernamen, Ergebnis und Auswahlstatus haben keine
  separaten Hintergrundkacheln, Rahmen oder Schatten mehr.
- Nur die Hintergrundfarbe ist leicht transparent. Waffenbilder, Texte und
  Bedienelemente bleiben vollständig deckend, auch bei gesperrter Waffenwahl.
  Die Auswahl bleibt mit Teamfarbe und Häkchen erkennbar; der Tastaturfokus
  erhält eine klare Kontur.
- Bei reduzierter Bewegung bleibt auch die statische Verliererwaffe deckend.
  Graustufen und die Beschriftung „Besiegt“ zeigen das Ergebnis. Die animierte
  Zerstörung der Verliererwaffe bleibt erhalten.
- Angepasste Innenabstände halten beide Panels auf schmalen Spielfeldern
  kompakt. Waffengrößen, Kampfphasen, Mannschaftsjubel und Spielregeln bleiben
  erhalten. SVG- und PNG-Atlanten werden unverändert weiterverwendet.
- Vollständige Lieferung und aktuelle QNAP-Updateversion: 0.4.6.

## 0.4.5

### Waffenwahl, Kampf-Overlay und Mannschaftsjubel

- Die geheime Waffenwahl wandert aus der Statuskarte mittig über das Spielfeld.
  Das transparente Overlay zeigt „Wähle deine Waffe“, größere Einzelwaffen,
  die aktuelle Duellrunde und den privaten Bestätigungsstatus. Nach gleicher
  Wahl öffnet sich dort die nächste Runde. Die Statuskarte behält den neutralen
  Schiedsrichter und den Duellhinweis.
- Jeder neu bestätigte Kampf erhält eine kurze Präsentation mit beiden
  öffentlichen Waffen, Zusammenstoß, Kampfwolke, zerbrechender Verliererwaffe
  und pulsierendem Sieger. Gleiche Waffen bleiben neutral; Fallen und Flaggen
  werden anhand des bestätigten Kampfergebnisses angezeigt.
- Die Kampfphasen warten auf das Ende der jeweiligen CSS-Animation. So laufen
  spätere Phasen dem ersten Aufbau der SVG-Symbole nicht voraus. Die Wolke ist
  bereits in ihrem ersten Animationsbild sichtbar; ein begrenzter Ersatz-Timer
  verhindert ein dauerhaft blockierendes Overlay bei fehlenden Animationsereignissen.
- Die gesamte verbliebene Gewinnerarmee hüpft nach der Kampfpräsentation kurz
  auf ihren Feldern. Auch ein Partiensieg ohne neues Kampfereignis wird einmalig
  gefeiert. Besitzerfarbe und Spielfeldperspektive bleiben unverändert.
- Laufende Kampfüberlagerungen sperren weitere Brettzüge kurzzeitig. Die Wahl
  wird erst danach freigegeben. Bereits bestätigte oder ausstehende eigene
  Wahlen sind gesperrt; fremde geheime Wahlen werden nicht angezeigt.
- Ohne Animationen beziehungsweise bei reduzierter Bewegung erscheint ein
  kurzes statisches Ergebnis. Neue Partien, Verlassen und Unterbrechungen räumen
  laufende Präsentationen auf; wiederholte Snapshots lösen keine Wiederholung aus.

### Gelbe Fallen und richtungsabhängiger Schiedsrichter

- ICQ-Retro-Fallen behalten für beide Spieler wieder die goldgelben Farben
  ihrer ursprünglichen Vorlage. Pro Blickrichtung sind die beiden Farbslots
  identisch; die Kämpfer behalten ihre feste Besitzerfarbe.
- Zielflaggen sind getauscht: Die blaue Mannschaft verwendet ein rotes Tuch,
  die rote ein blaues. Körper, Sockel und Besitzerfarbe bleiben erhalten.
  Retro und Arcade enthalten die Änderung in SVG und PNG, Klassisch in seinen
  Vektorzeichnungen. Die Schiedsrichterflaggen werden davon nicht beeinflusst.
- Der Atlas ergänzt `referee-blue-top` und `referee-red-bottom`. Zusammen mit
  `referee-blue-turn` (Blau unten), `referee-red-turn` (Rot oben) und der neutralen
  Pose sind jetzt vier Farbrichtungen und eine neutrale Haltung vorhanden.
  Die zusätzlichen Posen tauschen ausschließlich die Flaggenfarben der
  bestehenden Zeichnungen; der Schiedsrichter wird nicht gespiegelt.
- Das optionale `directionalTurnPortraits.<blue|red>.<top|bottom>` verweist auf
  diese Frames. Der aktive Spieler bzw. Sieger bestimmt weiterhin die Farbe;
  `view.you` bestimmt die Richtung: unten für die eigene Seite, oben für den
  Gegner. Die Auswahl funktioniert auch bei Pause und nach Wiederbeitritt.
- Die neutrale Pose bleibt bei Lobby, Aufstellung, Duell und Remis aktiv.
  Ältere Grafiksets fallen auf `colorTurnPortraits`, `turnPortraits` und
  schließlich `portrait` zurück. Der Parser prüft alle neuen Schlüssel und
  Frame-Referenzen.
- Die Schiedsrichtergrafik in der Spiel-Statuskarte wird von 136 × 102 auf
  180 × 135 Pixel vergrößert. Richtung und Farbe sind zusätzlich im DOM und in
  der barrierefreien Beschriftung verfügbar.
- SVG und PNG werden gemeinsam neu erzeugt: 41 Motive auf 1728 × 2016,
  ursprüngliche 39 Frame-Koordinaten unverändert. Der normale Produktionsbuild
  erzeugt weiterhin die passenden gzip-Dateien.
- Vollständige Lieferung und aktuelle QNAP-Updateversion: 0.4.5.

## 0.4.4

### Vollständiger ICQ-Retro-Vektoratlas

- Der primäre `atlas.svg` umfasst 39 Motive auf 1728 × 2016 Einheiten:
  24 Basisfiguren in beiden Farben und Blickrichtungen, sechs Aufdeckposen,
  zwei Brettkacheln, Logo, drei Schiedsrichterposen und drei einzelne Waffen.
- Echte Pfadvektorisierung der Figuren mit originalnahen Konturen und
  angenäherten Schattierungen. Brettkacheln, Logo und Schiedsrichter verwenden
  native Vektorverläufe; die gezeichneten Waffen werden direkt übernommen.
  Die SVG enthält keine eingebetteten Rasterbilder.
- `atlas.png` wird aus der vollständigen SVG frisch exportiert und verwendet
  dieselben 39 Motive, Bildmaße und Frame-Koordinaten. Die frühere PNG aus 0.4.3
  bleibt unter `design/icq-retro-source/original.png` als Bearbeitungsquelle erhalten.
- `atlas.image` unterstützt SVG; das optionale `atlas.fallbackImage` benennt
  die Rückfallgrafik mit denselben Frame-Koordinaten. Oberflächensymbole verwenden
  direkt die SVG, das Brett rendert sie bei Bedarf mit höherer Auflösung.
- ICQ Retro verwendet einen gemeinsamen Hauptatlas. Sein gesonderter
  `weaponAtlas`-Eintrag entfällt; eigene Sets mit diesem optionalen Feld bleiben
  unterstützt. `weapon-atlas.svg` bleibt als bearbeitbare Waffenquelle enthalten.
- Optionales `scripts/build-retro-atlas.py` baut SVG, PNG und `skin.json`
  gemeinsam. `scripts/retro_vectorize.py` verwendet Pillow und libpotrace;
  Inkscape exportiert die PNG. Quellen sind `original.png`, `layout.json` und
  `referees.svg` unter `design/icq-retro-source/` sowie `weapon-atlas.svg`.
  `scripts/build-retro-weapons.mjs` ruft denselben vollständigen Pythonbuild auf.
  Der normale Spielbuild benötigt diese Grafikwerkzeuge nicht.
- Arcade lädt ebenfalls seine echte SVG `master.svg` zuerst und verwendet
  `atlas.png` als Rückfall. Die 147 Frames und ihre Animationsclips bleiben erhalten.
- `scripts/compress-skin-svgs.mjs` erzeugt über `build:compress-skins` nach dem
  Vite-Build gzip-Dateien unter `dist/client/skins`. Der Server liefert sie
  für eingebaute SVGs bei passender `Accept-Encoding`-Aushandlung aus;
  die SVG-Adresse und Originaldatei bleiben erhalten. Beim Retro-Atlas sinkt
  die Übertragung damit von etwa 9,9 MB auf 2,13 MB. Eigene NAS-Dateien haben
  Vorrang; fehlt eine komprimierte Datei, wird die normale SVG ausgeliefert.
  Dafür sind keine zusätzliche Abhängigkeit oder Caddy-Änderung nötig.
- Die Schiedsrichter-Statuskarte, lesbaren Auswahllisten und Retro-Figuren ohne
  gelbe Aufdeckpunkte bleiben erhalten. Aktuelle Liefer- und Updateversion: 0.4.4.

### Feste Teamfarben und Blickrichtungen

- Seat 0 bleibt blau, Seat 1 rot, unabhängig vom Browser und vom Spieler am Zug.
  Die eigene Armee steht weiterhin unten von hinten, der Gegner oben von vorn.
  Beide Farben erhalten die nötigen Vorder-/Rückansichten und Aufdeckposen;
  Fallen und Flaggen zeigen ebenfalls ihre Teamfarbe.
- Namen, Avatare, Teamlegende, Punktestand, Startspieler, Zug- und Sieganzeigen,
  Schiedsrichter und Kampfrückblick verwenden dieselbe feste Zuordnung.
  Die mitgelieferten Klassik- und Arcade-Paletten sind ebenfalls Blau/Rot.
- `teamPieces.<blue|red>.<own|enemy>` trennt Besitzerfarbe von Blickrichtung.
  Alte `pieces.own`- und `pieces.enemy`-Einträge bleiben als blaue beziehungsweise
  rote Farbvarianten unterstützt.
- Drei neue Schiedsrichterposen nach den Nutzerreferenzen: blaue Flagge vorn
  unten, rote vorn oben, neutral beide seitlich ausgestreckt. Zugspieler und
  Sieger wählen `colorTurnPortraits.blue/red`; fehlende Einträge verwenden
  die festen alten Slots `turnPortraits.own` für Blau und `.enemy` für Rot,
  danach das neutrale `portrait`. Duelle und Remis bleiben neutral.

## 0.4.3

### Einzelne Retro-Waffen und schärfere Darstellung

- Drei einzeln gezeichnete Waffen für die Regelerklärung und die geheime
  Waffenwahl im Duell, einschließlich jeder Wiederholung bei gleichen Waffen:
  grauer rundlicher Stein, helle Papierrolle und silberne Schere mit gelben Griffen.
- Echter Vektoratlas `weapon-atlas.svg` mit 960 × 320 Einheiten. Er enthält
  ausschließlich Vektorformen und wird als CSS-Hintergrundbild ausgeschnitten.
- Dieselben drei Waffen zusätzlich als `weapon-rock`, `weapon-paper` und
  `weapon-scissors` im Hauptatlas. `atlas.png` umfasst jetzt 1121 × 1787 Pixel
  und 24 Frames; die Pixel und Koordinaten der bisherigen 21 Motive bleiben erhalten.
- Optionale Felder `weapons` und `weaponAtlas` im Grafikset-Format. Die
  Waffenreferenzen zeigen auf Frames des Hauptatlas; der optionale Waffenatlas
  verwendet dieselben Frame-Namen mit eigenen Koordinaten und unterstützt SVG,
  PNG, WebP und JPEG. Ein Ladefehler dieser optionalen Datei lässt die
  Waffenbilder aus dem Hauptatlas weiterhin erscheinen.
- Die Waffen erscheinen in den Regeln mit 44 Pixeln und in der Duellauswahl
  mit 56 Pixeln. Sets ohne separate Waffenbilder verwenden ihre bisherigen Symbole.
- Der Schiedsrichter steht in der Retro-Spielansicht direkt in der Statuskarte
  an der Stelle der bisherigen textlichen Zuganzeige. Die Flaggen zeigen
  weiterhin Zugspieler, Sieger oder einen neutralen Spielabschnitt.
- Die aktive Auswahl im Retro-Designmenü erhält einen dunkelolivgrünen
  Hintergrund mit heller Schrift; weitere Optionen erscheinen dunkel auf hell.
- Die gelben Aufdeckpunkte entfallen bei `presentation: "retro"`. Der bestätigte
  Aufdeckstatus und die dazugehörigen Figurenposen bleiben erhalten; andere
  Darstellungen behalten ihre Aufdeckmarker.
- Das Brett nutzt beim Start die Pixeldichte des Bildschirms bis Faktor 2.
  Die logische Fläche bleibt 680 × 616; bei DPR 2 oder höher umfasst der
  Zeichenpuffer 1360 × 1232 Pixel. Ein Monitorwechsel erfordert für die neue
  Pixeldichte ein Neuladen. Die Interaktionskoordinaten bleiben unverändert.
- Optionales Grafikwerkzeug `scripts/build-retro-weapons.mjs` aktualisiert
  die Waffenreihe der PNG aus der SVG. `sharp` wird nur bei dieser Bearbeitung
  benötigt; der normale Spielbuild verwendet die mitgelieferten Grafiken.
- Vollständige Lieferung und aktuelle Update-Zielversionen auf 0.4.3 angepasst.
  Die vorhandene QNAP-HTTPS-Konfiguration benötigt keine Änderung.

## 0.4.2

- Grafikkorrektur der aufgedeckten blauen Papier- und Scherenfiguren anhand der
  blauen Steinfigur unten links in der Map: gemeinsame Vorlage für Kopf, Körper,
  Armhaltung, Ärmel und Hand; nur das Werkzeug wird ausgetauscht.
- Werkzeugränder liegen hinter demselben blauen Ärmel und derselben Hand.
- Vollständige Lieferung und Zielversionsangaben auf 0.4.2 aktualisiert.

## 0.4.1

### Aufgedeckte Figuren und Zug- sowie Sieganzeige

- Drei zusätzliche statische Posen für eigene blaue Stein-, Papier- und
  Scherenfiguren. Die Werkzeuge liegen vorn oder seitlich in einer Hand;
  Papier und Schere übernehmen die tiefe, natürliche Armhaltung der blauen
  Steinfigur. Eine teilweise Verdeckung durch Kopf, Körper oder Hand ist möglich.
- Zwei zusätzliche Schiedsrichterposen: Der Arm mit der aktiven blauen oder
  roten Flagge wird gehoben, die andere Flagge bleibt hinter dem Rücken.
  Rot gehört zur anatomisch rechten Hand, Blau zur linken; neutral sind beide
  Arme ausgestreckt, mit Rot links und Blau rechts im Bild.
- Die Teamfarbe gilt aus Sicht des jeweiligen Browsers: Blau für die eigene
  Seite, Rot für den Gegner. Während eines Zugs zeigt sie den aktiven Spieler,
  nach einem Sieg den Gewinner. Lobby, Aufstellung, Duell, wiederholte gleiche
  Waffenwahl und ein Remis verwenden die neutrale Pose mit beiden Flaggen.
  Eine Pause während eines Zugs erhält dessen Farbe.
- Retro-Map auf 21 statische Ausschnitte in einer RGBA-PNG mit 1121 × 1403 Pixeln
  erweitert. Die neuen Zustandsbilder sind unabhängig vom Animationsschalter;
  neue Animationsclips wurden nicht ergänzt.

### Grafikformat

- Optionales `pieces.<team>.<figur>.revealed` mit eigenem `frame` und optionalen
  `animations` für öffentlich aufgedeckte Figuren. Ohne diese Variante bleibt
  die bisherige Figurendarstellung erhalten; weitere Verschachtelung ist nicht erlaubt.
- Optionales `turnPortraits.own` und `turnPortraits.enemy` für Zug- und Sieganzeige.
  Fehlt die jeweilige Pose, wird das bestehende neutrale `portrait` verwendet.
- Auswahl der Figurenvariante und Schiedsrichterpose anhand des bestätigten
  Spielstands; unbekannte Figurentypen bleiben verdeckt.
- Vollständige ZIP einschließlich Quellcode, Grafik-Map, Konfiguration und
  Produktionsbuild; Update-Anleitungen auf die Zielversion 0.4.1 gebracht.

## 0.4.0

### Gemeinsame Spielserien

- Freie Serie, Best of 3 und Best of 5 als validierte Raumeinstellung.
- Siegstand, Remiszähler, Serien- und Partienummer sowie erster Spieler im
  gefilterten Spielstand und in der Oberfläche.
- Zentrale, einmalige Wertung jedes Partieendes; Duellgleichstände zählen
  nicht als Remis einer Partie.
- Wechselnder Startspieler nach jeder Partie und über Seriengrenzen hinweg.
- Zwei übereinstimmende Stimmen starten die nächste Partie oder setzen die
  Serie zurück. Serien- und Partiekennungen verhindern veraltete Zustimmungen.
- Entschiedene Best-of-Serien können gemeinsam als neue Serie gestartet werden.
- Wiederverbindung erhält Identität, Partie und Siegstand; Verbindungsabbruch
  löscht offene Fortsetzungsstimmen. Ein Serverstopp vergibt keinen Sieg.
- Mobil führt der Beitritt beziehungsweise eine neue Partie wieder zum Spielbereich.

### Grafikset ICQ Retro

- Recherche anhand historischer Spielaufnahmen des ICQ-Spiels.
- Per Bildgenerierung erstellte RGBA-Bild-Map mit 1254 × 1254 Pixeln und
  16 statischen Ausschnitten: zwölf Figuren, zwei Kacheln, Logo und Schiedsrichter.
- Grünes, zusammenhängendes Schachbrett und rote/blaue Cartoon-Figuren;
  eigene Waffen sichtbar, verdeckte Gegner einheitlich dargestellt.
- Optionales `presentation: "retro"` für die passende Brett- und
  Oberflächengestaltung sowie `portrait` für das statische Schiedsrichterbild.
- Retro als Vorgabe für neue Browser; vorhandene Auswahl und bisherige
  Grafiksets bleiben nutzbar. Keine zusätzlichen Animationsclips in dieser Lieferung.
- Dokumentierte Recherchequellen und vollständige Bildprompts im Ordner `design/`.

### Lieferung und Prüfung

- `client/board.ts`, `client/main.ts`, Server, geteilte Typen, Tests und
  Produktionsbuild vollständig aktualisiert.
- Onlineprüfung prüft zusätzlich Grafikdatei, Serienwertung, wechselnden
  Startspieler, Wiederbeitritt mit Punkten und gemeinsames Zurücksetzen.
- Update-Anleitung für das bereits funktionierende QNAP-DNS-HTTPS mit beiden
  Compose-Dateien; öffentlicher Port 8443 und NAS-Port 18443 bleiben bestehen.

## 0.3.3

### Token-Eingabe auf QNAP ohne stty

- Das Einrichtungsskript erkennt die Unterstützung von `read -r -s -p` mit
  einer künstlichen Leerzeile und verwendet die verdeckte Eingabe der Shell.
- `stty` ist nur noch eine Alternative für Shells ohne diese eingebauten Optionen.
- Fehlendes Terminal, fehlende Eingabefähigkeiten und Fehler beim Lesen der
  Terminaleinstellungen werden getrennt gemeldet.
- Verdeckte Eingabe, Echo-Wiederherstellung, Abbruch und Erhalt einer vorhandenen
  Secret-Datei wurden in echten Terminaltests einschließlich Bash als `sh` geprüft.
- Vollständiger Produktionsbuild 0.3.3; DNS-Betrieb, HTTPS-Ports und Spielinhalte
  sind aus 0.3.2 enthalten.

## 0.3.2

### Zertifikatserneuerung über dynv6-DNS

- Ergänzendes `compose.dns.yaml` für denselben Caddy-Dienst; veröffentlicht nur
  den NAS-HTTPS-Port 18443. Öffentliche Spieladresse bleibt auf Port 8443.
- Eigenes Caddy-2.11.7-Image mit festgelegter Version des dynv6-DNS-Moduls.
- `Caddyfile.dns` verwendet DNS-01 mit öffentlichen DNS-Resolvern und deaktiviert
  HTTP-Weiterleitungen. Bestehende Zertifikats-Volumes bleiben erhalten.
- Dynv6-HTTP-Token als lokale Datei mit unsichtbarer Eingabe, Rechten 600 und
  schreibgeschütztem Compose-Secret; aus Git und Image-Build-Kontext ausgeschlossen.
- Isolierter, zeitlich begrenzter DNS-Stagingtest im Einmalcontainer mit eigenem
  temporärem Zertifikatsspeicher; vor der Umstellung des laufenden Spiels nutzbar.
- Hauptanleitung auf den vorhandenen 8443-Zugang ausgerichtet; bisherige Anleitung
  für Standardports unter `QNAP-HTTPS-STANDARD.md` erhalten.

## 0.3.1

### HTTPS auf dem vorhandenen QNAP

- Optionaler Caddy-Dienst im Compose-Profil `https`, fest auf das offizielle
  Image `caddy:2.11.7-alpine` gesetzt.
- Reverse Proxy für HTTP und WebSockets zum bestehenden Dienst `rps:2567`.
- Automatische Zertifikatsverwaltung mit persistenten, benannten Volumes.
- QNAP-Hostports 18080 und 18443; getrennte FRITZ!Box-IPv4-Weiterleitungen von
  extern 80 beziehungsweise 443. Keine Veröffentlichung der Caddy-Admin-API.
- Domain und NAS-Ports über Compose-Variablen einstellbar. Die optionale
  Browser-Origin-Liste wird jetzt ausdrücklich in den Spielcontainer übernommen.
- Online-Prüfscript zusätzlich im Runtime-Image enthalten, damit die
  Funktionsprüfung direkt per `docker compose exec` möglich ist.
- Neue Anleitung `QNAP-HTTPS.md`: FRITZ!Box 6660 Cable, DNS einschließlich
  vorhandener IPv6-Einträge, Einrichtung, Prüfung, Updates und Rückkehr zum LAN.

Grafiksets, Spielregeln und Animationen sind vollständig aus v0.3.0 enthalten.

## 0.3.0

### Darstellung und Bedienung

- Grafikset-System mit lokalem Katalog, editierbaren Farben und optionalem
  Bildatlas für Spielfeldkacheln, Logosymbol und Spielfiguren.
- Sets „Klassisch“ und „Arcade“. Arcade enthält einen echten PNG-Atlas,
  editierbaren SVG-Master und alle sechs Figurendarstellungen für beide Teams.
- Auswahl und Animationsschalter pro Browser. Reduzierte Bewegung aus den
  Systemeinstellungen wird respektiert.
- Bildfolgen für idle, selected, move, duel, attack, win und lose.
- Sichtbare Zugbewegung, Angriff, Aufdecken, Verliererentfernung und zwei
  Siegerpulse; neue bestätigte Aktionen können eine alte Animation ablösen.
- Start, Ziel und Richtung der letzten Aktion bleiben am Brett markiert.
- Ergebnisleiste mit aufgedeckten Beteiligten, Gewinner und entfernten Figuren.
- Aufklappbare Chronik mit bis zu 100 Ereignissen der laufenden Partie.
- Aufstellung durch Ziehen zweier eigener Figuren, zusätzlich zu Maus-/Touch-
  Auswahl und Tastatursteuerung.
- Abschaltbare, lokal erzeugte Retro-Töne für Züge und Kampfresultate;
  anfangs ausgeschaltet.

### Server und Bereitstellung

- Öffentliche, je Betrachter gefilterte `lastAction`-Daten für Animationen.
  Geheime erste Duellwahlen bleiben privat. Synchronisieren und Wiederverbinden
  erzeugen keine neuen Aktions-IDs.
- Optionale Grafik-Overrides über `SKINS_DIR`, schreibgeschützter NAS-Ordner
  `./skins` in Compose und ungecachte Grafikauslieferung.
- Fehlerhafte Grafiken führen auf das eingebaute Design zurück; fehlende
  optionale Figurenbilder verwenden die vorhandenen Vektorsymbole.
- Neue Tests für Ereignisgeheimhaltung, Wiederverbindung, Framefolgen,
  Grafikvalidierung und HTTP-Auslieferung externer Grafiksets.

### Regelstand

Die dokumentierten Regeln aus Version 0.2 gelten weiter. Für Fallenverhalten,
dauerhafte Sichtbarkeit aufgedeckter Figuren, Waffenwechsel und historische
Startaufstellung ist der Abgleich mit einer verlässlichen Originalanleitung
weiter offen. Diese Version behauptet keine vollständige 1:1-Rekonstruktion
der ICQ-Regeln. Konten, Ranglisten und dauerhaft gespeicherte Partien sind
weiterhin spätere Ausbauschritte.

## 0.2.0

- Vorbereitung des Online- und Dockerbetriebs mit Bereitschaftsprüfung,
  Versionsantwort und ausdrücklich behandeltem Serverneustart.
- Geprüfte Wiederverbindung, private Räume und Produktionsstart.
- Auf dem QNAP TS-251D mit Container Station erfolgreich im LAN betrieben.
