# Grafiksets für RPS Arena v0.4.30

Jedes eingebaute Design ist ein eigenständiges Paket unter `public/skins/<id>/`.
Es enthält sein Manifest, Atlanten, Gewinnerbilder, Gonganimation, Sounds,
editierbare Vorlagen und Audio-Lizenzen. Auch ICQ Retro Dark besitzt alle zur
Laufzeit verwendeten Dateien selbst. Die zentrale Oberfläche liest die Ressourcen
aus dem Manifest; neue Designs benötigen keine Abzweigungen nach Design-ID.

Für die Gegenüberstellung vor einem Kampf enthalten die eingebauten Atlanten
die waffenneutralen Frames `battle-blue-left`, `battle-blue-right`,
`battle-red-left` und `battle-red-right`. Sie zeigen ausschließlich die Teamfarbe.
Ohne diese optionalen Frames bleibt die normale Figur sichtbar. Die editierbare
Vorlage liegt in `source/battle-poses.svg`; nach den übrigen Atlas-Exportern
aktualisiert `node scripts/build-battle-poses.mjs` die SVG-, PNG- und mobilen
WebP-Atlanten gemeinsam (benötigt das optionale Playwright-Grafikwerkzeug).

Die beiden ICQ-Designs verwenden dafür die saubere Vektorzeichnung
`icq-retro/source/side-profile.svg`, nach den Seitenposen des Referenzvideos.
Die früheren Ausschnitte bleiben als Zeichenvorlage erhalten, werden aber nicht
im Atlas eingebettet. Unter `icq-retro/source/video-side-poses.json` stehen Quelle, Zeitpunkte und Masken;
`scripts/extract-video-poses.mjs` reproduziert die PNGs mit dem Video, FFmpeg und
Playwright als Argumenten. Beide Designs teilen diese Quelldateien. Die Bilder
übernehmen die Rechte des Originalmaterials und sind nicht CC0.

Die ICQ-Sprechporträts liegen unter `speech/` sowie als `*-speaking.svg` bei
den Ergebnisbildern. `node scripts/build-referee-speech.mjs` erzeugt sie aus
den bestehenden Schiedsrichtervorlagen. Die Mundbewegung ist nur während
der tatsächlichen Ansagen aktiv und respektiert deaktivierte Animationen.

Klassisch und Arcade verwenden bei der Gegenüberstellung ihre normalen Symbole.
Die Seitenposen der ICQ-Figuren und die Symbole bleiben bis zum Schließen des
Kampf-Overlays nebeneinander stehen.

## Ein Design hinzufügen

1. Einen vollständigen Designordner kopieren, zum Beispiel `public/skins/classic/`
   nach `public/skins/mein-design/`. Vorhandene Ordner nicht überschreiben.
2. `name`, Farben, Bilder und Audiozuordnungen in `skin.json` anpassen.
3. Im Feld `skins` von `public/skins/index.json` den Eintrag
   `{ "id": "mein-design", "name": "Mein Design", "file": "mein-design/skin.json" }` ergänzen.
4. `/skins/mein-design/preview.html` im laufenden Spielserver öffnen und
   `npm run build` sowie `npm test` ausführen.

Für NAS-Overrides gilt dieselbe Ordnerstruktur unter `skins/` beziehungsweise
`SKINS_DIR`. Relative Ressourcenpfade bleiben innerhalb des ausgewählten Pakets.
Das bestehende `assetPack` betrifft nur Atlasbilder; neue vollständige Designs
sollten ihre Dateien selbst mitbringen.

| Pfad im Designordner | Inhalt |
| --- | --- |
| `skin.json` | Farben, Frames, Bewegungswerte sowie Audio- und Grafikzuordnung |
| `atlas.svg` / `master.svg`, PNG, WebP | Brett, Figuren, Symbole und mobile Varianten |
| `endgame/` | Neun SVGs: beide Farben mit happy/sad/neutral, Schiri blue/red/neutral |
| `gong/idle.svg`, `gong/strike.svg` | Selbstständige SVGs mit eingebetteter Grafik und Animation |
| `audio/` | Ogg-Effekte, lokal erzeugte WAV-Stimmen, Lizenztexte und `SOURCES.json` |
| `source/` | Editierbare SVGs, Gong-CSS, Originalvorlagen und Arbeitsnotizen |
| `preview.html` | Bilder und einzeln abspielbare Sounds zur Designkontrolle |

## Audio und zusätzliche Grafiken konfigurieren

Das optionale Feld `audio` ordnet Ereignisse relativen Dateien zu:

```json
{
  "audio": {
    "gong": { "file": "audio/gong.ogg", "volume": 0.8, "rate": 1 },
    "blueTurn": { "file": "audio/blueTurn.wav", "volume": 0.85, "rate": 1 }
  },
  "artwork": {
    "endgame": "endgame",
    "gong": { "idle": "gong/idle.svg", "strike": "gong/strike.svg", "strikeMs": 380, "durationMs": 1500 }
  }
}
```

Alle Audioereignisse: `shuffle`, `move`, `moveBlue`, `moveRed`, `rock`, `paper`, `scissors`, `trap`, `flag`,
`duel`, `win`, `lose`, `draw`, `gong`, `redTurn`, `blueTurn`, `youWin`, `youLose`.
`shuffle` begleitet die erste Aufstellung und den bestätigten „Mischen“-Befehl.
`node scripts/build-shuffle-audio.mjs` erzeugt die Klassisch-/Arcade-Mischsounds
reproduzierbar und verknüpft die unveränderten `original-bling.wav` der Retro-Pakete.
Der normale Audioexport ruft diesen Schritt ebenfalls auf. Die Sounds können
unter „Mischen / Aufstellung“ in der jeweiligen `preview.html` probegehört werden.
Die ersten drei Waffenereignisse begleiten den Zusammenprall; Falle und Flagge
besitzen eigene Effekte. `win`/`lose` sind kurze Kampfergebnisse,
`youWin`/`youLose` die gesprochenen Partieergebnisse aus Sicht des Betrachters.
Zugfarben folgen den festen Spielersitzen. Zuganzeige und Zugansage warten auf
das tatsächliche Ende der Bewegung und sämtlicher laufender Sounds sowie danach
eine volle Sekunde. Bis dahin bleibt der Schiedsrichter neutral und die
Figurensteuerung gesperrt. Ansagen warten außerdem auf die sichtbare
Ergebnisszene beziehungsweise das Ende der Startanimation. Wiederverbinden,
Neuladen, Pausieren und Synchronisieren lösen keine verspäteten Ansagen aus.

Unterstützt werden Ogg, WAV, MP3 und M4A; pro Datei maximal 1 MiB und zehn
Sekunden dekodierte Dauer. `volume` liegt zwischen 0 und 1 (Standard 0.7),
`rate` zwischen 0.5 und 2 (Standard 1). Mit `variants` können bis zu fünf weitere
relative Audiodateien pro Ereignis angegeben werden. Sie wechseln bei jedem
Ereignis der Reihe nach. `moveBlue` und `moveRed` verwenden getrennte Varianten
für die feste Besitzerfarbe; fehlt eine Teamzuordnung, dient `move` als Ersatz.
Alle vier Designs enthalten zwei Bewegungsvarianten je Farbe. Fehlerhafte oder fehlende Effekte
fallen auf einen kurzen Signalton zurück; fehlende Stimmen werden ausgelassen.
Stummschalten und Designwechsel stoppen bereits geplante Sounds. Ohne gespeicherte
Auswahl sind Spielsounds aktiv; eine gespeicherte Stummschaltung bleibt erhalten.

## Klangquellen und lokale Sprachproduktion

- Kenney: [Impact Sounds](https://kenney.nl/assets/impact-sounds) und
  [Digital Audio](https://kenney.nl/assets/digital-audio), beide CC0 1.0.
- rubberduck: [100 CC0 SFX](https://opengameart.org/content/100-cc0-sfx), CC0 1.0, für die Gongaufnahmen.
- Recherchierte Sprachbibliotheken: Kenneys Voiceover Pack und Voiceover Pack
  (Fighter) enthalten „you win“/„you lose“, aber nicht die benötigten
  Farb-Zugansagen. Auf Nutzerwunsch wird keine dieser Sprecheraufnahmen eingebunden.
- Die synthetischen Stimmen werden offline mit [eSpeak NG](https://github.com/espeak-ng/espeak-ng)
  erzeugt: englischer Text im Mandarin-Sprachprofil `cmn`. Dies ist eine
  synthetische Mandarin-geprägte Aussprache, keine menschliche Dialektaufnahme.
  Klassisch verwendet eine ruhige Stimme, Retro einen tieferen Klang und Arcade
  eine schnellere raue Variante. Retro Dark verwendet dieselbe synthetische Retro-Alternative; aktiv sind dort die folgenden Videoansagen.

Die Sounddateien sind bereits enthalten. Zum Reproduzieren die drei Archive
lokal in `impact/`, `digital/`, `gong/` entpacken. Außerhalb des Projekts
`espeak-ng@1.0.2` (npm-Paket mit WASM) bereitstellen, dann:

```text
node scripts/build-skin-audio.mjs <ordner-der-audioarchive> <espeak-ng-paket/dist>
```

Zur Laufzeit gibt es keine externen Audioabrufe und keine Sprachsynthese.
Originaldateinamen, SHA-256, Urheber, Syntheseparameter und Lizenzangaben stehen
pro Paket in `audio/SOURCES.json`. Das Synthesewerkzeug selbst wird nicht
mitgeliefert. Seine GPL-Lizenz ist von den erzeugten Sprach-WAVs getrennt;
die erzeugten Sprachdateien werden als CC0 bereitgestellt.

## Originalsounds aus dem ICQ-Video

Auf ausdrücklichen Nutzerwunsch verwenden ICQ Retro und Retro Dark kurze
Originalausschnitte aus [Rock Paper Scissors in ICQ (RPS)](https://www.youtube.com/watch?v=Q2sDtTbzHiI)
von shachar700. Diese ersetzen die aktiven Retro-Zuordnungen für Gong, Bewegung,
Stein, Papier, Schere, Flagge sowie „red turn“, „blue turn“, „you win“ und
„you lose“. Auch die Kampfergebnisse `win` und `lose` verwenden die extrahierten
Originalansagen. Beide Retro-Pakete enthalten keine OGG-Dateien oder OGG-Zuordnungen.
Die synthetischen Retro-WAVs bleiben als optionale Alternativen enthalten.
Für Ereignisse ohne Originalaufnahme greift der allgemeine synthetische Sound-Fallback.
Klassisch und Arcade verwenden weiterhin lokal erzeugte Sprachansagen.
Die rote Ansage stammt vollständig aus 05:18,10–05:19,45; der nächste
Bewegungssound bleibt außerhalb dieses Ausschnitts. Zwei verschiedene
Bewegungsaufnahmen pro Team ergänzen die ursprüngliche Standardbewegung.

Die Videometadaten weisen keine freie Wiederverwendungslizenz aus. Deshalb sind
`audio/original-*.wav` ausdrücklich **nicht CC0**. Quellen, genaue Zeitbereiche,
SHA-256 und Bearbeitung stehen in `audio/SOURCES.json` und
`source/video-audio-cuts.json` jedes Retro-Pakets. Die Video-Audiospur selbst
und die Extraktionswerkzeuge werden nicht mit dem Spiel ausgeliefert.

Zum Reproduzieren mit einer lokalen Kopie der Video-Audiospur:

```text
node scripts/extract-retro-audio.mjs <lokale-audio-oder-videodatei> <ffmpeg-programmpfad>
```

Der Export erzeugt Mono-PCM-WAVs mit 22050 Hz, normalisiert auf -2 dBFS und
entfernt Schnittklicks mit kurzen Ein-/Ausblendungen. Tonhöhe und Tempo bleiben
erhalten. Die isolierte Gongaufnahme endet vor der anschließenden Zugansage;
ein nur für den Gong ergänzter Hallausklang verlängert das Nachklingen um
2,1 Sekunden und blendet weich in die Stille aus. Eine erneute
CC0-/Sprachgenerierung behält die aktiven Originalzuordnungen und deren
abweichende Lizenzhinweise bei.

## Grafiken neu exportieren

Die Retro-Figuren verwenden ihre vorhandenen Sprites auch für Ruhebewegungen.
Leichte Drehungen (maximal 1,3 Grad) und Skalierungen (maximal 2,5 Prozent)
ersetzen zusätzliche Figurenposen im Atlas. Da das Brett auf einer gemeinsamen
Phaser-Canvas gezeichnet wird, erfolgen diese Verformungen direkt im Renderer.
Vorderansichten zwinkern durch zwei Augen-Overlays mit einer gemeinsam genutzten,
zur Laufzeit erzeugten 60×38-Pixel-Textur. Die Augen schließen für 160 Millisekunden;
Rückansichten erhalten keine Augenzeichnung. Die Render-Schleife schläft zwischen
den kurzen Animationen und wird erst zum nächsten Zufallszeitpunkt geweckt.
Die Retro-Atlanten werden auch auf hochauflösenden Desktop-Bildschirmen in ihrer
nativen Größe zur GPU übertragen: Die 272-Pixel-Zellen reichen für die maximal
152 Pixel hohe Darstellung einer Figur auf einem 2×-Brett aus.
Sichtbare Fallen/Attrappen bleiben statisch; als unbekannte Figur verdeckte
Fallen bewegen sich weiterhin wie die anderen verdeckten Figuren.
Der Client spielt kurze Bewegungen mit unabhängigen Zufallsabständen von
10–40 Sekunden ab, fünfmal seltener als zuvor; die Einstellung für Animationen
gilt auch hier mobil.
Nach zehn Sekunden ohne Spielaktion beider Spieler gähnt der Schiedsrichter
einmal mit `audio/original-yawn.wav`. Eine neue Aktion setzt die Wartezeit zurück;
Pause, Verbindungsunterbrechung und ausgeblendete Seiten unterbrechen sie.
Die Gähnpose ersetzt den rechten Fahnenarm durch einen angewinkelten Arm mit
Hand vor dem Mund. Die linke Hand hält weiterhin die blaue Fahne.

Nach den übrigen Atlasexportern entfernt
`node scripts/build-retro-idle.mjs [playwright-Modulpfad]` frühere Figuren-Ruheposen
und erzeugt die kompakten Rastervarianten. Nur die statische Gähnpose bleibt als
zusätzlicher Atlas-Frame erhalten. Der PNG-Export wird verlustfrei komprimiert.
`yawn.svg` enthält die einmalige Gähnanimation; `referee-yawn` ist ihre statische
Atlasvariante bei reduzierter Bewegung. Gong und Schiri sind im mobilen
Kopfbereich zweifach skaliert, ohne dessen reservierte Höhe zu verändern.

`node scripts/build-gong-art.mjs` erzeugt die beiden Gong-SVGs aus
`source/gong.svg` und `source/gong.css`. Die Retro-SVGs betten das freigestellte
Nutzermotiv ein und trennen die vorhandenen Schlägerpixel mit Masken.
`node scripts/build-gong-atlases.mjs <sharp-modulpfad>` ergänzt die Ruhe- und
Schlagpose in Haupt-, PNG- und Mobilatlas. Die Zeilenvorschau liegt in
`source/gong-atlas.svg`. Diesen Export nach den anderen Atlasexporten ausführen.
`node scripts/build-skin-previews.mjs` aktualisiert die Designvorschauen.

`node scripts/build-style-referees.mjs <sharp-modulpfad>` erzeugt die
Gewinnerbilder für Klassisch und Arcade sowie ihre Zuganzeigen.
`python scripts/build-endgame-art.py` erzeugt die Retro-Gewinnerbilder für
beide Retro-Ordner aus `public/skins/icq-retro/source/`.
Blau bleibt im Gewinnerbild links, Rot rechts; das Overlay spiegelt die blaue
Schiri-Anzeige, deren Ausgangsgrafik nach rechts zeigt.

Fallen- und Flaggenbegegnungen verwenden vollständige Figuren statt Waffen.
`node scripts/build-combat-atlases.mjs` ergänzt alle vier Sets um die Frames
`combat-trap-hole`, `combat-flag-blue`,
`combat-flag-red`, `combat-puff` und zwei Ersatzfiguren für Sets ohne Figurenatlas.
Die Flaggenframes sind nach dem bisherigen Besitzer benannt und zeigen dessen
Zielflagge. Die editierbaren SVG-Vorlagen liegen in `public/skins/<design-id>/source/combat.svg`. Der Export
liest diese Quellen und ergänzt Hauptatlas, PNG-Fallback und mobilen WebP-Atlas
samt Manifesten. Bestehende Frame-Koordinaten bleiben erhalten; neue Retro-Motive
erhalten dieselbe Auflösung wie die übrigen Figuren. Das Werkzeug benötigt
`sharp`; als erstes Argument kann dessen installierter Modulpfad angegeben werden.
Nach einem Neuaufbau der ursprünglichen Atlanten diesen Export zuletzt ausführen.

`python scripts/build-combat-art.py` erzeugt die Quellvorlagen bei Bedarf neu:
Retro verwendet die Fahnen aus den Siegerposen; Arcade übernimmt seine vorhandenen
Spielsteinformen, Klassisch die Strichstärken und Formen des Linien-Iconsets.
Fallloch und Rauch folgen jeweils derselben Kontur-, Farb- und Schattensprache.
Die Falltür selbst verwendet direkt die vorhandene verdeckte Figur des Besitzers,
mit derselben Vorder- oder Rückenansicht wie auf dem Brett; dafür gibt es keinen
zusätzlichen Attrappenframe.
Der Quellgenerator benötigt nur die Python-Standardbibliothek. Manuelle Änderungen
in `public/skins/<design-id>/source/combat.svg` bleiben beim reinen Atlasexport erhalten.

Die optionale Manifest-Eigenschaft `chatNotice` verweist auf den Atlas-Frame für
neue Chatnachrichten. Die mitgelieferten Designs enthalten passende
Sprechblase; ICQ Retro verwendet eine Comic-Kontur mit cremefarbener Füllung.
Auch `mobileAtlas.frames` muss diesen Frame enthalten.

Die editierbaren SVG-Vorlagen liegen in `public/skins/<design-id>/source/chat-notice.svg`. Nach Änderungen
oder einer Neuerzeugung der ursprünglichen Atlanten fügt
`node scripts/update-chat-atlases.mjs` die Motive in freie Atlasplätze ein und
aktualisiert SVG, PNG-Fallback, mobilen WebP-Atlas und Manifeste gemeinsam. Dieses
optionale Grafikwerkzeug benötigt `sharp`; alternativ kann als erstes Argument
der Pfad zu einer vorhandenen `sharp`-Installation übergeben werden. Bestehende
Frame-Koordinaten bleiben erhalten. Der normale Spielbuild verwendet die
mitgelieferten Dateien und benötigt dieses Werkzeug nicht.

RPS Arena trennt das Aussehen von den Spielregeln. Ein Grafikset kann Farben,
Spielfeldkacheln, Figuren, kurze Figurenanimationen, einzelne Waffen, das Logo,
statische Schiedsrichterposen und optionale Flaggensieger ändern. Vier Sets werden mitgeliefert:

| Set | Darstellung |
| --- | --- |
| **ICQ Retro** | Am ICQ-Spiel orientiertes Design mit grünem Schachbrett, roten/blauen Figuren und vollständigem SVG-Atlas mit PNG-Rückfallgrafik |
| **ICQ Retro Dark** | Eigene Atlanten mit dunklen Brettfeldern, denselben Figuren und Symbolen wie ICQ Retro sowie dunklen Seitenflächen und Overlays |
| **Klassisch** | Bisherige dunkle Oberfläche mit Vektorfiguren; zugleich Rückfall bei einem fehlerhaften Set |
| **Arcade** | Dunkles Vektorbildset mit primärer `master.svg`, passender PNG-Rückfallgrafik und 148 Frames einschließlich vorhandener Figurenclips und Sprechblase |

Ein Manifest kann mit `"assetPack": "icq-retro"` die Bilddateien dieses lokalen
Grafiksets wiederverwenden. Die Frame-Definitionen bleiben im eigenen Manifest;
Hauptatlas, Rasterfallback, Waffenatlas und Mobilatlas werden im angegebenen
Grafikset gesucht. Erlaubt sind ausschließlich lokale Grafikset-IDs mit kleinen
Buchstaben, Ziffern, Bindestrich oder Unterstrich, keine Pfade oder URLs.
ICQ Retro Dark verwendet eigene Bilddateien. Mit
`node scripts/build-dark-retro-atlas.mjs` lassen sich SVG, PNG und mobiles WebP
aus dem hellen Original neu erzeugen. Das Werkzeug benötigt optional `sharp`
(bei Bedarf dessen Modulpfad als erstes Argument übergeben). Nur die beiden
Brettkacheln werden abgedunkelt; die übrigen Figurenpixel und Vektorpfade bleiben
erhalten. Nach Änderungen am Originalatlas den Dark-Export erneut ausführen.

**ICQ Retro ist der neue Standard.** Eine bereits gespeicherte gültige Designwahl
wird beim Update beibehalten. Wähle **ICQ Retro** unter **Design**, wenn dein
Browser weiterhin das bisherige Set zeigt.

Die Auswahl findest du oben unter **Design**. Im Retro-Menü erhält die aktive
Option einen dunkelolivgrünen Hintergrund mit heller Schrift; weitere Optionen
verwenden dunkle Schrift auf hellem Hintergrund. Die Auswahl und der Schalter
**Animationen** werden in diesem Browser gespeichert. Eine Einstellung für
reduzierte Bewegung im Betriebssystem hat Vorrang: Dann werden die Figuren
statisch dargestellt und die Bewegung wird nicht animiert. Kämpfe zeigen dann
kurz ein statisches Ergebnis; die Waffenwahl bleibt normal bedienbar.

Unter **Design ? Spielsounds** lassen sich Designsounds und Schiedsrichteransagen gemeinsam ein- und ausschalten.
In allen vier mitgelieferten Sets ist **Seat 0 blau und Seat 1 rot**. Diese
Zuordnung bleibt in beiden Browsern gleich. Die eigene Armee steht weiterhin
unten; ICQ Retro zeigt sie von hinten und die gegnerische Armee von vorn.
Teamfarbe und Blickrichtung sind deshalb getrennte Eigenschaften. Die Retro-Fallen
sind unabhängig vom Besitzer in beiden Blickrichtungen goldgelb; die Farbslots
benennen weiterhin den Besitzer und beeinflussen ihre gelbe Gestaltung nicht.
Die Zielflaggen tragen die Gegenfarbe: Bei der blauen Mannschaft ist das Tuch
rot, bei der roten blau. Die Figur beziehungsweise der Sockel bleibt in der
Besitzerfarbe. Namen, Spielstand und Schiedsrichter verwenden weiterhin die
tatsächliche Spielerfarbe. Dies gilt ebenfalls für Klassisch und Arcade.

Der Raumchat unter dem Spielfeld verwendet ebenfalls die feste Besitzerfarbe
für die Namen. Er gehört zur Spieloberfläche und benötigt keine Atlasmotive.
Enter oder **Senden** überträgt eine Nachricht mit bis zu 300 Unicode-Zeichen;
der Raum behält die letzten 50 Nachrichten im Arbeitsspeicher über Partien und
Wiederverbindungen hinweg. Bei einem Serverneustart endet dieser Verlauf.

## Die neue Grafik-Map „ICQ Retro“

Die Datei `public/skins/icq-retro/atlas.svg` liegt seit Version 0.4.4 als
vollständiger Vektoratlas vor. Version 0.4.7 enthält **43 Motive als Vektorgrafiken**
auf einer Zeichenfläche von **2016 × 2016**.
Die Figurenkonturen stammen aus der bisherigen Vorlage; ihre Schattierungen
sind als Vektorflächen angenähert. Kacheln, Logo und Schiedsrichter verwenden
auch native Vektorverläufe. Die beiden neuen Flaggensieger sind native SVG-Zeichnungen.
Die drei gezeichneten Vektorwaffen werden direkt
übernommen. Die SVG enthält keine eingebetteten Rasterbilder.

`atlas.png` wird als **2016 × 2016 Pixel große RGBA-PNG** aus dieser SVG neu
exportiert. Das Set lädt sie automatisch, wenn die primäre SVG nicht verwendet
werden kann. Beide Bilder enthalten dieselben Motive in denselben 44 Ausschnitten;
ihre gemeinsame Zuordnung steht in `public/skins/icq-retro/skin.json`:

| Ausschnitte | Inhalt | Anzahl |
| --- | --- | ---: |
| `blue-back-<figur>`, `red-back-<figur>` | Rückenansichten für jeweils Stein, Papier, Schere, Flagge, Falle und unbekannte Figur | 12 |
| `blue-front-<figur>`, `red-front-<figur>` | Vorderansichten für dieselben sechs Figuren je Farbe | 12 |
| `blue-back-<waffe>-revealed`, `red-back-<waffe>-revealed` | Aufgedeckte Stein-, Papier- und Scherenfiguren mit Werkzeug vorn oder seitlich in einer Hand | 6 |
| `board-light`, `board-dark` | Zwei grüne Spielfeldkacheln | 2 |
| `logo` | RPS-Arena-Logo | 1 |
| `referee-neutral` | Neutraler Schiedsrichter mit beiden seitlich ausgestreckten Flaggen | 1 |
| `referee-blue-turn`, `referee-red-turn` | Blaue Flagge vorn unten beziehungsweise rote Flagge vorn oben | 2 |
| `referee-blue-top`, `referee-red-bottom` | Blaue Flagge vorn oben beziehungsweise rote Flagge vorn unten | 2 |
| `weapon-rock`, `weapon-paper`, `weapon-scissors` | Grauer Stein, helle Papierrolle und silberne Schere mit gelben Griffen | 3 |
| `blue-front-flag-victory`, `red-front-flag-victory` | Lächelnde Frontposen mit erhobener tatsächlich eroberter Flagge | 2 |
| `chat-notice` | Comic-Sprechblase für ungelesene Chatnachrichten | 1 |

Mit der Chat-Sprechblase sind das **44 statische Ausschnitte**. Die vier unbekannten Figurenbilder
zeigen keine Waffe und verraten keinen Figurentyp. Bewegung zwischen Feldern,
die Kampfanimation und der Mannschaftsjubel bewegen und skalieren diese
Bilder. Die Flaggeneroberung verwendet zusätzlich ihre beiden statischen Siegerposen.
Das Format für zusätzliche Figurenclips ist bereits vorhanden und in Abschnitt 5 beschrieben.

Die Einzelwaffen in der Regelerklärung und in jeder Runde der geheimen
Waffenwahl kommen ebenfalls aus dem vollständigen Hauptatlas. Regeln verwenden
44 Pixel große Bilder. Die zentrale Waffenwahl verwendet 88 Pixel große Bilder,
bei schmalen Spielfeldern 64 Pixel. Im Kampfoverlay sind es 104 beziehungsweise
rund 81 Pixel. Gemeint ist jeweils die längere Bildkante.
`public/skins/icq-retro/weapon-atlas.svg` bleibt als bearbeitbare Waffenquelle
erhalten, wird vom Retro-Set aber nicht mehr separat geladen. Eigene Sets mit
einem optionalen `weaponAtlas` bleiben unterstützt.

### Waffenwahl und Kämpfe über dem Spielfeld

Seit 0.4.5 zeigt „Wähle deine Waffe“ drei große Einzelwaffen mittig über dem
Brett. Seit 0.4.6 haben Waffenwahl und Gefecht jeweils einen gemeinsamen,
leicht transparenten Panelhintergrund, im Retro-Design helloliv. In v0.4.7 beträgt
seine Deckkraft bei Klassisch und Arcade 85 Prozent, bei Retro weiterhin 92 Prozent.
Diese Fläche liegt durchgehend hinter allen Elementen; Überschrift, Spielernamen und Status
benötigen keine separaten Hintergrundkacheln mehr. Nur die Hintergrundfarbe ist
transparent: Waffenbilder, Texte und Bedienelemente bleiben vollständig deckend.
Das Brett bleibt um das Panel herum sichtbar. Bei bestätigter eigener Wahl sind
die Schaltflächen gesperrt, die Symbole bleiben jedoch deckend; Teamfarbe und
Häkchen kennzeichnen die Auswahl. Die andere Entscheidung bleibt bis zur
gemeinsamen Aufdeckung geheim.

Ein neu bestätigter Kampf zeigt beide öffentlichen Waffen in v0.4.7 nominell
3 Sekunden lang. Die Phasen verteilen sich so:

| Phase | Dauer |
| --- | ---: |
| Annäherung | 600 ms |
| Zusammenstoß mit Kampfwolke | 600 ms |
| Zerbrechen der Verliererwaffe und Rückbewegung | 700 ms |
| Hervorhebung des Siegers | 1100 ms |

Nach der bestätigten Waffenwahl liegen vor dem Kampf zusätzlich 600 Millisekunden.
Gleiche Waffen zeigen ein neutrales Ergebnis und öffnen anschließend die nächste
Wahlrunde. Fallen und Flaggen verwenden die
passenden Figurenbilder. Die Besitzerfarbe bleibt in beiden Browsern gleich.
Die Phasen folgen dem Ende der jeweiligen CSS-Animation. Benötigt der Browser
beim ersten SVG-Aufbau länger, kann sich der Ablauf entsprechend verlängern.

Nach einem normalen Kampfgewinn hüpfen die verbliebenen Figuren der siegreichen
Mannschaft zweimal kurz auf ihren Feldern. Dafür sind 776 Millisekunden Animationszeit vorgesehen; ein
stark belasteter Browser kann die Bewegung langsamer abspielen. Der Jubel ändert
keine Spielposition. Die Bilder stammen aus dem gewählten Grafikset; SVG und
PNG-Rückfall nutzen denselben Ablauf. Ohne Animationen wird der Kampf für
350 Millisekunden statisch gezeigt und die Mannschaft hüpft nicht.

### Siegerpose bei Flaggeneroberung

Nur der durch den abschließenden öffentlichen Kampf bestätigte Eroberer einer
Flagge erhält die besondere Pose. In beiden Browsern steht er lächelnd von
vorn mit erhobener eroberter Flagge. Die bisherigen Zielflaggen werden nicht
erneut getauscht:

| Sieger | Besitzer der eroberten Flagge | Tuch in der Siegerpose |
| --- | --- | --- |
| Blau / Seat 0 | Rot / Seat 1 | Blau |
| Rot / Seat 1 | Blau / Seat 0 | Rot |

Beim Flaggensieg springen alle verbliebenen Figuren der Gewinnerarmee viermal
gleichzeitig. Dafür sind 1680 Millisekunden vorgesehen. Anschließend bleibt
der Eroberer in seiner Siegerpose auf dem Zielfeld, solange die Partie beendet
ist. Sie erscheint auch nach einer Wiederverbindung; vergangene Sprünge werden
dabei nicht wiederholt. Bei ausgeschalteten Animationen oder reduzierter Bewegung
steht die Siegerpose von Anfang an statisch. SVG und PNG verwenden dieselben Motive.

Eigene Grafiksets können passende Frames optional auf oberster Ebene zuordnen:

```json
"flagVictoryFrames": {
  "blue": "blue-front-flag-victory",
  "red": "red-front-flag-victory"
}
```

Die genannten Frame-Namen müssen im Hauptatlas definiert sein. Beide Farben
sind optional; ohne passenden Eintrag bleibt die reguläre Figur sichtbar.
Die Zuordnung folgt der festen Siegerfarbe und hat keine getrennten eigenen
oder gegnerischen Blickrichtungen. Ein Sieg durch Aufgabe oder fehlende legale
Züge verwendet diese Flaggenpose nicht.

ICQ Retro verwendet `presentation: "retro"` für zusammenhängende rechteckige
Spielfeldkacheln und die passende Oberfläche. Das Set ist eine neu erstellte
Annäherung an das historische Design; Quellen und Gestaltungsentscheidungen
stehen in [ICQ-RETRO.md](public/skins/icq-retro/source/ICQ-RETRO.md).

## 1. Eigene Grafiken auf dem NAS ohne neuen Containerbau

Der Projektordner auf deinem QNAP ist:

```text
/share/Container/rps-arena/rps-remake
```

Darin gibt es zwei getrennte Orte:

| Ordner | Aufgabe |
| --- | --- |
| `public/skins` | Mitgelieferte Vorlagen und Grafiksets. Vite übernimmt sie beim Build nach `dist/client/skins`; sie sind damit im Container enthalten. |
| `skins` | Deine eigenen Dateien auf dem NAS. Docker Compose bindet diesen Ordner unter `/app/skins` schreibgeschützt ein. Diese Dateien lassen sich ohne neuen Build ändern. |

Die mitgelieferte `compose.yaml` enthält dafür:

```yaml
environment:
  SKINS_DIR: /app/skins
volumes:
  - "./skins:/app/skins:ro"
```

Das ist ein Ausschnitt zur Erklärung. Dein bestehendes DNS-01-HTTPS-Projekt
verwendet die vollständige `compose.yaml` zusammen mit `compose.dns.yaml`.
Das Versionsupdate einschließlich der eingebauten Grafiksets wird einmal mit
beiden Dateien gebaut. In der bisher verwendeten Administrations-SSH-Shell:

```sh
cd /share/Container/rps-arena/rps-remake
docker compose -p rps-arena -f compose.yaml -f compose.dns.yaml --profile https up -d --build --wait --wait-timeout 120
docker compose -p rps-arena -f compose.yaml -f compose.dns.yaml --profile https ps
```

Der vollständige Ablauf steht in [QNAP-UPDATE.md](QNAP-UPDATE.md). Führe den
Containerwechsel zwischen zwei Partien durch. Partien, Serienwertungen und
Chatverläufe liegen im Arbeitsspeicher des Servers und enden beim Neustart.

Danach reicht es bei Änderungen an `skins` aus, die Datei zu speichern und die
Spielseite neu zu laden. Ein Containerneustart oder erneuter Build ist für diese
Grafikänderungen nicht nötig. `:ro` bedeutet, dass der Spielcontainer den Ordner
nur lesen kann; du kannst ihn weiterhin mit File Station oder deiner
Dateifreigabe bearbeiten.

### So findet der Server eine Datei

Eine Anfrage nach `/skins/arcade/master.svg` sucht zuerst nach
`skins/arcade/master.svg` im eingebundenen NAS-Ordner. Fehlt sie dort, liefert der
Server die eingebaute Datei aus `dist/client/skins/arcade/master.svg`.

Diese Suche erfolgt **für jede Datei einzeln**. So kannst du beispielsweise nur
das Arcade-Bild ersetzen und die eingebaute JSON-Datei weiterverwenden. Das neue
Bild muss dann dieselben Bildmaße und Bildausschnitte besitzen.

Die Grafikdateien werden mit `Cache-Control: no-store` ausgeliefert. Eine bereits
geöffnete Spielseite behält ihr geladenes Set bis zum nächsten Laden. Fehlt der
optionale externe Ordner ganz, startet der Server trotzdem mit den eingebauten
Sets.

### Komprimierte Auslieferung eingebauter SVGs

`npm run build` führt nach dem Vite-Build `build:compress-skins` aus.
Das Skript `scripts/compress-skin-svgs.mjs` ergänzt für SVG-Dateien unter
`dist/client/skins` eine komprimierte `.svg.gz`-Datei und behält das jeweilige
SVG-Original. Die Quellen unter `public/skins` bleiben unverändert bearbeitbar.

Bei GET- und HEAD-Anfragen auf eingebaute SVGs handelt der Server anhand von
`Accept-Encoding` aus, ob gzip verwendet wird. Die Bildadresse bleibt etwa
`/skins/icq-retro/atlas.svg`; die komprimierte Antwort hat weiterhin den
SVG-Inhaltstyp, dazu `Content-Encoding: gzip` und `Vary: Accept-Encoding`.
Auch dafür gilt `Cache-Control: no-store`. Dadurch wird die größere bearbeitbare
Vektorquelle für die Übertragung komprimiert. Die Größe hängt vom jeweiligen
Atlasstand ab.

Dateien aus dem eigenen `SKINS_DIR` werden weiterhin zuerst ausgeliefert und
von dieser Komprimierung nicht verändert. Fehlt eine passende komprimierte
Datei im eingebauten Bestand oder wird gzip nicht ausgehandelt, liefert der
Server die normale SVG. Das Verfahren benötigt keine neue Projektabhängigkeit
und keine Änderung der vorhandenen Caddy-Konfiguration.

## 2. Ein eigenes Grafikset anlegen

Für eine Variante des neuen Designs beginne mit einer Kopie von ICQ Retro:

1. Kopiere den vollständigen Ordner `public/skins/icq-retro` nach
   `skins/mein-design` im Projekt auf dem NAS.
2. Öffne `skins/mein-design/skin.json` und ändere `name` in `Mein Design`.
3. Lege `skins/index.json` mit folgendem Inhalt an.
4. Lade die Spielseite neu und wähle unter **Design** den Eintrag **Mein Design**.

```json
{
  "version": 1,
  "default": "icq-retro",
  "skins": [
    { "id": "icq-retro", "name": "ICQ Retro", "file": "icq-retro/skin.json" },
    { "id": "classic", "name": "Klassisch", "file": "classic/skin.json" },
    { "id": "arcade", "name": "Arcade", "file": "arcade/skin.json" },
    { "id": "mein-design", "name": "Mein Design", "file": "mein-design/skin.json" }
  ]
}
```

`index.json` ist der Katalog für die Design-Auswahl. Sein `default` gilt, wenn im
Browser noch keine gültige eigene Auswahl gespeichert ist. Die IDs müssen
eindeutig sein; verwende kleine Buchstaben, Ziffern, `-` und `_`, beispielsweise
`mein-design`. Die Pfade in `file` sind relativ zu `/skins/` und müssen genau
`<id>/skin.json` heißen, für dieses Beispiel also `mein-design/skin.json`.

**Ein eigener Katalog ersetzt den eingebauten Katalog.** Klassisch wird als
Rückfallmöglichkeit immer in der Auswahl ergänzt. Behalte `icq-retro`, `arcade`
und alle weiteren gewünschten Sets in deiner Liste. Existiert bereits ein
eigener Katalog aus einer früheren Version, ergänze den Eintrag für `icq-retro`
dort; das Spiel erweitert deinen Katalog nicht automatisch um dieses Set. Du
musst die Dateien eingebauter Sets nicht in den eigenen Ordner kopieren; dafür
greift die eingebaute Dateisuche.

Das Layout deiner eigenen Dateien ist anschließend:

| Datei | Inhalt |
| --- | --- |
| `skins/index.json` | Liste der verfügbaren Grafiksets |
| `skins/mein-design/skin.json` | Farben, Darstellung und Zuordnung der Bildausschnitte |
| `skins/mein-design/atlas.svg` | Primäres Vektorbild mit allen Motiven |
| `skins/mein-design/atlas.png` | Passende Rückfallgrafik mit denselben Bildmaßen und Ausschnitten |
| `skins/mein-design/weapon-atlas.svg` | Bearbeitbare Quelle der Einzelwaffen; im Retro-Set nicht separat geladen |

Das primäre Laufzeitbild steht unter `atlas.image`, die automatische
Rückfallgrafik unter `atlas.fallbackImage`. Die vollständige Retro-SVG lässt
sich mit einem Vektorwerkzeug bearbeiten. Wenn du ihre Bildinhalte änderst,
exportiere auch eine passende PNG mit denselben Maßen und Ausschnitten,
damit die Rückfallanzeige dieselben Motive verwendet.

Arcade verwendet seit 0.4.4 `master.svg` als primäres Laufzeitbild und `atlas.png`
als Rückfallgrafik. Nach Änderungen am Master exportierst du auch dort die PNG
neu. Bildmaße, 148 Frames und die vorhandenen Animationsclips bleiben erhalten.

## 3. Nur Farben ändern

Ein Set braucht kein eigenes Bild. Dieses vollständige Beispiel nutzt die
eingebauten Vektorfiguren und ändert nur einige Farben und die Zugdauer:

```json
{
  "version": 1,
  "name": "Nachtblau",
  "palette": {
    "ui": {
      "background": "#101A2C",
      "panel": "#192B41",
      "accent": "#67D7F0",
      "accentText": "#102334"
    },
    "board": {
      "light": "#2A4059",
      "dark": "#203248",
      "selected": "#35657C"
    }
  },
  "motion": { "moveMs": 180 }
}
```

Speichere es beispielsweise als `skins/nachtblau/skin.json` und ergänze den
Katalog entsprechend. Nicht angegebene Farbwerte werden aus dem eingebauten
Standard ergänzt. Farben sind sechsstellige Hexwerte in der Form `#RRGGBB`.

| Bereich | Unterstützte Schlüssel |
| --- | --- |
| `palette.ui` | `background`, `panel`, `border`, `text`, `muted`, `accent`, `accentText`, `own`, `enemy` |
| `palette.board` | `light`, `dark`, `border`, `setupOwn`, `setupEnemy`, `selected`, `accent`, `duel`, `coordinates`, `shadow`, `dots`, `focus`, `ownBase`, `ownEdge`, `ownSymbol`, `enemyBase`, `enemyEdge`, `enemySymbol`, `revealed` |

Die bestehenden Farbslot-Namen haben eine feste Zuordnung: `own` sowie
`setupOwn`, `ownBase`, `ownEdge` und `ownSymbol` gelten für **Blau / Seat 0**;
`enemy` und die entsprechenden `enemy`-Felder für **Rot / Seat 1**. Sie wechseln
nicht mit dem Betrachter. Die Felder `ownBase`, `ownEdge` und `ownSymbol` sowie
ihre `enemy`-Gegenstücke gestalten die eingebauten Vektorfiguren. Farben innerhalb
der Atlasmotive änderst du in der jeweiligen SVG- oder Rasterdatei selbst. `palette.board.revealed` bestimmt die
Farbe des zusätzlichen Aufdeckmarkers in den anderen Darstellungen. Bei
`presentation: "retro"` wird dieser Punkt seit 0.4.3 nicht mehr gezeichnet;
der Aufdeckstatus und die vorgesehenen Figurenposen bleiben erhalten.

## 4. Figuren, Logo und Spielfeld aus einem Sammelbild

Ein **Atlas** ist ein Bild mit mehreren einzelnen Symbolen oder Animationsbildern.
In `skin.json` bekommt jeder Ausschnitt einen Namen und ein Rechteck in den
Koordinaten der Bild- beziehungsweise Zeichenfläche.
Der Ursprung liegt oben links im Bild.

Das folgende Beispiel setzt ein selbst erstelltes, mindestens 192 × 96 Pixel
großes `atlas.png` voraus. Es ersetzt das Logosymbol und über den alten
Farbslot `pieces.own` die blaue Steinfigur für Seat 0:

```json
{
  "version": 1,
  "name": "Mein erstes Bildset",
  "atlas": {
    "image": "atlas.png",
    "frames": {
      "mein-logo": { "x": 0, "y": 0, "width": 96, "height": 96 },
      "mein-stein": { "x": 96, "y": 0, "width": 96, "height": 96 }
    }
  },
  "logo": "mein-logo",
  "pieces": {
    "own": {
      "rock": { "frame": "mein-stein" }
    }
  }
}
```

PNG eignet sich für Symbole mit transparentem Hintergrund. Der Hauptatlas
unter `atlas.image` unterstützt seit 0.4.4 neben PNG, WebP und JPEG auch SVG.
Der optionale Waffenatlas unter `weaponAtlas.image` unterstützt dieselben
Bildformate. Ein Bild liegt im selben Set-Ordner oder einem Unterordner;
externe Bildadressen und Verweise außerhalb dieses Ordners werden nicht verwendet.

### SVG-Hauptatlas mit automatischer Rückfallgrafik

Für einen Vektoratlas ergänzt du im vorhandenen `atlas`-Objekt diese Angaben:

```json
"image": "atlas.svg",
"fallbackImage": "atlas.png"
```

Die vorhandenen `frames` bleiben im selben Objekt stehen. SVG und PNG müssen
dieselbe Zeichenfläche beziehungsweise Bildgröße und dieselbe Anordnung der
Motive verwenden. Als `fallbackImage` sind lokale PNG-, WebP- und JPEG-Dateien
erlaubt; es muss eine andere Datei als `image` sein. Die Angabe ist optional;
ohne sie gelten die bisherigen Lade- und Fehlerregeln für ein einzelnes Hauptbild.

Das Set versucht zuerst die Datei unter `image`. Kann sie nicht verwendet
werden, wird die angegebene Rückfallgrafik mit denselben Frame-Rechtecken
geladen. ICQ Retro verwendet dafür den PNG-Export seines vollständigen SVG-Atlas.
Ist auch die Rückfallgrafik nicht verwendbar, greift das integrierte Klassikdesign.
Die Grafikdefinition selbst wird weiterhin streng geprüft.

Verwende in einer SVG feste `width`- und `height`-Angaben sowie eine passende
`viewBox`, wie in der Retro-Vorlage. Die Oberfläche zeigt SVG-Ausschnitte direkt
als CSS-Hintergrundbilder. Das Brett rendert daraus bei Bedarf eine höher
aufgelöste Textur und behält die logischen Frame-Koordinaten bei. Die SVG wird
als Bild geladen; es wird kein SVG-`<use>`-Sprite in das Dokument eingebunden.

Für skalierbare Konturen müssen die Motive aus Vektorformen bestehen. Eine
PNG innerhalb einer SVG behält die ursprüngliche Rasterauflösung. Der neue
Retro-Atlas enthält daher echte Pfade für alle Motive.

Ein Frame-Rechteck besteht aus ganzzahligen `x`, `y`, `width` und `height`.
Breite und Höhe müssen positiv sein, und das Rechteck muss vollständig innerhalb
des Bildes liegen. Verschiebst du Motive im Bild, passe ihre Rechtecke an. Ändere
nur die Motive innerhalb vorhandener Ausschnitte, wenn du die JSON-Datei behalten
möchtest. Die Arcade-Vorlage ist 1152 × 1248 Pixel groß und verwendet Ausschnitte
von jeweils 96 × 96 Pixeln. Exportiere deine bearbeitete Vorlage in diesen
nativen Maßen, wenn du ihre vorhandenen Frame-Koordinaten beibehalten möchtest.
Die Retro-Map verwendet eine 2016 × 2016 große Zeichenfläche mit unterschiedlich
großen Ausschnitten. Verwende dafür die exakten Rechtecke aus ihrer `skin.json`; die
Arcade-Koordinaten passen nicht zu diesem Bild. Die
drei bisherigen Schiedsrichterposen liegen in der sechsten Reihe; die zwei
zusätzlichen Farbrichtungen aus 0.4.5 belegen Plätze in der siebten Reihe.
Der blaue Flaggensieger ergänzt deren bisher freien sechsten Platz, der rote
steht oben in der neuen siebten Spalte. Jede Pose ist als eigener Frame definiert.
Die Koordinaten der bisherigen 41 Motive bleiben erhalten.

### Figurenbezeichnungen

Für jede Farbe und Blickrichtung können folgende Figuren definiert werden:

| Schlüssel | Darstellung |
| --- | --- |
| `rock` | Stein |
| `paper` | Papier |
| `scissors` | Schere |
| `flag` | Flagge |
| `trap` | Falle |
| `unknown` | Verdeckte Figur; das Motiv darf ihren tatsächlichen Typ nicht verraten |

Seit 0.4.4 trennt `teamPieces` die feste Besitzerfarbe von der Ansicht:

| Eintrag | Besitzer | Ansicht |
| --- | --- | --- |
| `teamPieces.blue.own` | Seat 0, blau | Eigene Figuren von hinten, beim blauen Spieler unten |
| `teamPieces.blue.enemy` | Seat 0, blau | Gegnerische Figuren von vorn, beim roten Spieler oben |
| `teamPieces.red.own` | Seat 1, rot | Eigene Figuren von hinten, beim roten Spieler unten |
| `teamPieces.red.enemy` | Seat 1, rot | Gegnerische Figuren von vorn, beim blauen Spieler oben |

Dieser Ausschnitt setzt die genannten Frames im Hauptatlas voraus:

```json
"teamPieces": {
  "blue": {
    "own": { "rock": { "frame": "blue-back-rock" } },
    "enemy": { "rock": { "frame": "blue-front-rock" } }
  },
  "red": {
    "own": { "rock": { "frame": "red-back-rock" } },
    "enemy": { "rock": { "frame": "red-front-rock" } }
  }
}
```

Die bisherigen `pieces.own`- und `pieces.enemy`-Einträge bleiben kompatibel.
Sie bedeuten seit 0.4.4 **blaue** beziehungsweise **rote** Farbvariante und
werden verwendet, wenn für die gewünschte Figur kein passender Eintrag unter
`teamPieces` vorliegt. Ein älteres Set behält damit seine vorhandenen Ansichten
und Animationsclips. Nur `own` und `enemy` **innerhalb von `teamPieces.<farbe>`**
bezeichnen die Blickrichtung relativ zum Betrachter.

Nicht definierte Figuren bleiben als eingebaute Vektorsymbole sichtbar. Die
Spielregeln bestimmen weiterhin, wann eine gegnerische Figur unbekannt ist; das
Grafikset erhält keine zusätzlichen Informationen. Figurenbilder erscheinen
auch in weiteren Figurenanzeigen außerhalb des Bretts und bleiben dort statisch.
Regelkarten und Duellschaltflächen können seit Version 0.4.3 eigene Waffenbilder
verwenden; ohne deren Definition erscheinen dort die bisherigen Figurensymbole.

### Einzelne Waffen und optionaler separater Atlas

Unter `weapons` lassen sich die drei Waffen `rock`, `paper` und `scissors`
unabhängig von ihren Spielfiguren zuordnen. Jeder Name muss als Frame im
Hauptatlas unter `atlas.frames` existieren. Einzelne Einträge dürfen fehlen;
für diese Waffe gilt dann die bisherige Figurendarstellung.

Dieser Ausschnitt ergänzt eine vollständige Grafikdefinition mit den genannten
Frames im Hauptatlas:

```json
"weapons": {
  "rock": "weapon-rock",
  "paper": "weapon-paper",
  "scissors": "weapon-scissors"
}
```

Diese Bilder werden für die Regelerklärung, die Waffenwahl im Duell und seit
0.4.5 auch für die zentrale Kampfanimation verwendet. Nach gleicher Wahl
beider Spieler erscheinen die Auswahlbilder erneut.
Die normalen Figurenbilder und ihre Aufdeckposen werden unter `teamPieces`
oder den kompatiblen `pieces`-Einträgen festgelegt. Ohne einzelne Waffenbilder
verwenden Regeln, Duell und Kampf die Figurensymbole in der festen Teamfarbe.

ICQ Retro verwendet seit 0.4.4 die Waffen aus seinem vollständigen SVG-Hauptatlas
und benötigt dafür keinen gesonderten `weaponAtlas` mehr. Für eigene Grafiksets
bleibt dieser optionale Abschnitt verfügbar, etwa wenn nur die Waffen aus einer
separaten Datei stammen sollen. Dieses Beispiel passt zum obigen `weapons`-Eintrag:

```json
"weaponAtlas": {
  "image": "weapon-atlas.svg",
  "frames": {
    "weapon-rock": { "x": 0, "y": 0, "width": 320, "height": 320 },
    "weapon-paper": { "x": 320, "y": 0, "width": 320, "height": 320 },
    "weapon-scissors": { "x": 640, "y": 0, "width": 320, "height": 320 }
  }
}
```

`weaponAtlas.frames` verwendet dieselben Namen, die unter `weapons` referenziert
werden, aber Rechtecke für seine eigene Datei. Die Ausschnitte des Hauptatlas
bleiben erforderlich. Die mitgelieferten Waffen haben dort diese Koordinaten:

| Frame | x | y | Breite | Höhe |
| --- | ---: | ---: | ---: | ---: |
| `weapon-rock` | 8 | 1736 | 272 | 272 |
| `weapon-paper` | 296 | 1736 | 272 | 272 |
| `weapon-scissors` | 584 | 1736 | 272 | 272 |

Der optionale Atlas darf nur einen Teil der unter `weapons` genannten Frames
enthalten. Für die übrigen Waffen erscheint der jeweilige Ausschnitt des
Hauptatlas. Andere Frame-Namen gehören nicht in `weaponAtlas`.

Für diese Datei sind SVG, PNG, WebP und JPEG erlaubt. Verwende bei SVG feste
`width`- und `height`-Angaben und eine passende `viewBox`, wie in der mitgelieferten
960 × 320 großen Vorlage. Das Spiel lädt die Datei als Bild und schneidet sie
per CSS-Hintergrundposition zu; es wird kein SVG-`<use>`-Sprite eingebunden.
Ein PNG innerhalb einer SVG würde weiterhin die Auflösung dieses PNG besitzen.
Für scharf skalierbare Waffen müssen die Motive selbst aus Vektorformen bestehen.

Auch für `weaponAtlas` lässt sich eine optionale `fallbackImage` angeben.
Sind die angegebene Datei und ihre Rückfallgrafik nicht verwendbar, bleiben
die Waffen aus dem Hauptatlas verfügbar. Ein ungültig definierter Grafikset-Eintrag
wird weiterhin als fehlerhaftes Set behandelt. Der optionale Waffenatlas ersetzt
nicht die Prüfung des Hauptatlas.

### Vollständigen Retro-Vektoratlas neu erzeugen

`scripts/build-retro-atlas.py` erzeugt **`atlas.svg`, `atlas.png` und `skin.json`
gemeinsam**. Die Bearbeitungsquellen sind:

| Datei | Zweck |
| --- | --- |
| `public/skins/icq-retro/source/original.png` | Aufgehobene PNG aus 0.4.3 als Vorlage für Figurenkonturen und ursprüngliche Gestaltung |
| `public/skins/icq-retro/source/layout.json` | Ausschnittplan dieser alten Bearbeitungsvorlage mit 1121 × 1787 Pixeln |
| `public/skins/icq-retro/source/referees.svg` | Vier Farb-/Richtungsposen und eine neutrale Schiedsrichterpose nach den Nutzerreferenzen |
| `public/skins/icq-retro/source/flag-victory.svg` | Zwei native, lächelnde Frontposen mit erhobener eroberter Flagge; je Motiv 320 × 320 Einheiten |
| `public/skins/icq-retro/weapon-atlas.svg` | Bearbeitbare Stein-, Papier- und Scherenmotive als Vektoren |
| `scripts/retro_vectorize.py` | Hilfsmodul für die Pfadvektorisierung mit Pillow und libpotrace |

Die Figuren werden als Pfade mit angenäherten Farbschattierungen übertragen;
beide Teamfarben entstehen aus denselben Konturen. Kacheln, Logo und
Schiedsrichter verwenden auch native Vektorverläufe. Die Flaggensieger werden
aus ihrer nativen SVG-Quelle übernommen. Der Build belegt
43 Motive auf 2016 × 2016 und exportiert aus der fertigen SVG die passende PNG.
Die goldgelben Trap-Farben werden nicht in die Besitzerfarbe umgerechnet.
Die 41 bisherigen Motive behalten ihre Koordinaten. Die frühere PNG dient dabei nur als Bearbeitungsvorlage.

Dieser optionale Arbeitsweg benötigt **Python 3 mit Pillow**, eine vom System
auffindbare **libpotrace** sowie **Inkscape** mit dem Befehl `inkscape` im
Suchpfad. Nach deren Installation im Projektordner ausführen:

```sh
python3 scripts/build-retro-atlas.py
```

Standardmäßig werden die drei Ausgabedateien unter `public/skins/icq-retro`
geschrieben. Mit `--output-dir <ordner>` kannst du sie in einem anderen Ordner
erzeugen. Die übrigen Manifestangaben wie die Palette liest der Build aus der
mitgelieferten `skin.json`; Atlas-, Figuren-, Waffen-, Schiedsrichter- und Siegerzuordnungen
setzt er passend zum vollständigen Satz neu.

Die fertigen SVG-/PNG-Dateien werden mitgeliefert. `npm run build` und der
Containerbau benötigen diese optionalen Grafikwerkzeuge nicht und führen
keine Vektorisierung aus.

### Einzelwaffen bearbeiten

Bearbeite `public/skins/icq-retro/weapon-atlas.svg`, um Stein, Papier und Schere
anzupassen. Behalte die drei 320 × 320 großen Felder dieser Quelle bei.
Anschließend führst du den vollständigen Build aus:

```sh
python3 scripts/build-retro-atlas.py
```

Der bisherige Aufruf `node scripts/build-retro-weapons.mjs` bleibt als
Kompatibilitätseinstieg erhalten. Er startet genau diesen vollständigen
Pythonbuild und benötigt dieselben optionalen Werkzeuge. So werden auch bei
einer reinen Waffenänderung SVG, PNG und Manifest gemeinsam aktualisiert.
Ein separater `weaponAtlas` wird im Retro-Manifest nicht mehr eingetragen.

Für ein eigenes Set übernimmst du `atlas.svg`, `atlas.png` und die passende
`skin.json` gemeinsam. Führe eigene Farb- oder weitere Manifest-Anpassungen
anschließend mit dieser Zuordnung zusammen. Die geänderten Bilder erscheinen
nach erneutem Laden der Spielseite. Direkte Bearbeitungen der fertigen
`atlas.svg` werden beim Neuerzeugen aus den Quellen ersetzt; passe für diesen
Arbeitsweg die zugrunde liegenden Quellen beziehungsweise den Generator an.

### Eigene Pose für aufgedeckte Figuren

Seit Version 0.4.1 kann eine Figur zusätzlich eine Variante unter `revealed`
definieren. Im Retro-Set wechseln die eigenen blauen oder roten Kämpfer nach
der öffentlichen Aufdeckung zu einer Pose mit Werkzeug vorn oder seitlich in einer Hand.
Papier und Schere übernehmen die tiefe, natürliche Armhaltung der blauen
Steinfigur. Kopf, Körper oder Hand dürfen das Werkzeug teilweise verdecken.
Bei den Rückenansichten liegen der kurze Ärmel in Teamfarbe und die Hand vor
dem Werkzeug und verdecken dessen Rand. Der Wechsel richtet sich nach dem
bestätigten Spielstand. Dass du die Waffe deiner eigenen Figur schon in der
Aufstellung kennst, löst ihn noch nicht aus.

Dieses Beispiel ist der Inhalt eines Figureneintrags wie `teamPieces.blue.own.rock`:

```json
{
  "frame": "blue-back-rock",
  "revealed": {
    "frame": "blue-back-rock-revealed"
  }
}
```

Beide Namen müssen unter `atlas.frames` stehen. `revealed` braucht einen eigenen
`frame` und kann dieselben optionalen `animations` wie die Basisfigur enthalten.
Es ist eine eigenständige Variante: Ihre Clips werden nicht mit denen der
Basisfigur vermischt. Ein weiteres `revealed` innerhalb dieser Variante ist
nicht zulässig. Fehlt die gesamte Variante, bleibt auch eine aufgedeckte Figur
bei ihrer bisherigen Darstellung. Unbekannte Figurentypen verwenden weiterhin
das Bild `unknown` und niemals eine Aufdeckpose.

Die statische Aufdeckpose erscheint auch bei ausgeschalteten Animationen oder
reduzierter Bewegung. ICQ Retro verwendet auch in 0.4.7 statische Posen ohne
zusätzliche Figurenclips.

`logo` verweist ebenfalls auf einen Frame. Er ersetzt das Symbol links neben dem
festen Schriftzug **RPS ARENA**. Das Bild wird proportional auf höchstens 42 Pixel
Kantenlänge skaliert. In der Retro-Darstellung erscheint dieses Logo außerdem
größer im Kopfbereich der Seitenleiste.

### Retro-Darstellung und Schiedsrichter

Das optionale Feld `presentation` akzeptiert `"modern"` und `"retro"`. Ohne
Angabe gilt `"modern"`. `"retro"` schaltet die kompakte, flache Oberfläche und
das Spielfeld ohne Zwischenräume zwischen den Kacheln ein. Farben und Grafiken
kommen weiterhin aus demselben Set und bleiben einzeln anpassbar.

Für das Logo und den Schiedsrichter verwendet ICQ Retro diese Felder:

```json
"presentation": "retro",
"logo": "logo",
"portrait": "referee-neutral",
"colorTurnPortraits": {
  "blue": "referee-blue-turn",
  "red": "referee-red-turn"
},
"directionalTurnPortraits": {
  "blue": { "top": "referee-blue-top", "bottom": "referee-blue-turn" },
  "red": { "top": "referee-red-turn", "bottom": "referee-red-bottom" }
}
```

Dieser Ausschnitt gehört in die vollständige `skin.json`. Alle genannten
Frame-Namen müssen unter `atlas.frames` definiert sein. `portrait` ist optional
und legt die neutrale Schiedsrichtergrafik fest. In der Retro-Spielansicht
erscheint der Schiedsrichter seit 0.4.3 direkt in der Statuskarte an der Stelle
der bisherigen textlichen Zuganzeige. Das große Logo bleibt im Kopfbereich.
In Aufstellung, Duell, Pause und Spielende bleiben die jeweiligen Überschriften
und Bedienelemente neben dem Bild erhalten. Ohne verwendbares Porträt bleibt
die textliche Statusanzeige sichtbar. Vor dem Raumbeitritt zeigt die Lobby
weiterhin den neutralen Schiedsrichter neben dem Logo.

`directionalTurnPortraits` ergänzt seit 0.4.5 die feste Besitzerfarbe um die
Browserperspektive. Erlaubt sind die Farben `blue` und `red` und darunter
`top` und `bottom`; jede Referenz muss als Frame des Hauptatlas existieren.
Die beiden Ebenen dürfen für eigene Sets teilweise definiert sein.

| Aktiver Spieler bzw. Sieger | Eigener Browser | Gegnerischer Browser |
| --- | --- | --- |
| Blau / Seat 0 | `directionalTurnPortraits.blue.bottom` | `directionalTurnPortraits.blue.top` |
| Rot / Seat 1 | `directionalTurnPortraits.red.bottom` | `directionalTurnPortraits.red.top` |
| Lobby, Warten, Aufstellung, Duell oder Remis | Neutrales `portrait` | Neutrales `portrait` |

Die Farbe folgt dem Seat des bestätigten `currentTurn` beziehungsweise nach
Spielende des `winner`. Ist dieser Spieler `view.you`, steht seine Seite unten;
sonst steht sie oben. Bei einer Verbindungspause bleibt die Richtung des
zuletzt bestätigten Zugspielers erhalten. Gleichstand und wiederholte gleiche
Waffenwahl verwenden weiterhin die neutrale Pose mit beiden Flaggen.
Im Spiel werden die 4:3-Frames jetzt mit 180 × 135 Pixeln angezeigt.

`colorTurnPortraits` bleibt als Zuordnung nach Besitzerfarbe unterstützt.
Fehlt eine passende Farbrichtung, wird zuerst `colorTurnPortraits.<farbe>`,
dann der alte `turnPortraits`-Slot und schließlich `portrait` verwendet.
Dabei bleibt `turnPortraits.own` fest Blau und `.enemy` fest Rot; die Slots
werden nicht nach Betrachter getauscht. Fehlt nur eine Richtung, verwendet die
Anzeige nicht die gegenteilige Richtung als Ersatz.
Die Bilder wechseln auch bei abgeschalteten Animationen. Eine eigene
Animationsdefinition für den Schiedsrichter gibt es nicht.

### Eigene Spielfeldkacheln

Neben Farben sind auch zwei Atlas-Ausschnitte für das Schachbrettmuster möglich:

```json
"board": {
  "light": "feld-hell",
  "dark": "feld-dunkel"
}
```

Die beiden Frame-Namen müssen in `atlas.frames` existieren. Das ist ein
Ausschnitt zum Einfügen in eine vollständige Definition. **`board.light` ist ein
Frame-Name; `palette.board.light` ist ein Farbwert.** Auswahl-, Ziel- und
Statusmarkierungen des Spiels bleiben darüber sichtbar. Der zusätzliche
Aufdeckpunkt wird bei `presentation: "retro"` nicht dargestellt.

## 5. Figuren animieren

Dieser Abschnitt beschreibt die bereits vorhandene Erweiterungsmöglichkeit.
Die Retro-Map in v0.4.7 enthält noch keine solchen Figurenclips; auch die
Flaggensieger sind einzelne statische Motive, deren Sprünge der Brett-Renderer erzeugt.

Jede Figur hat einen statischen `frame`. Zusätzlich können unter `animations`
Clips für sieben Zustände stehen:

| Zustand | Verwendung |
| --- | --- |
| `idle` | Ruhende Figur, wiederholt |
| `selected` | Aktuell ausgewählte Figur, wiederholt |
| `move` | Figur während eines Zugs, einmaliger Ablauf |
| `duel` | Am noch laufenden verdeckten Duell beteiligte Figur, wiederholt |
| `attack` | Beginn einer Kampfauflösung, einmaliger Ablauf |
| `win` | Gewinner der aufgelösten Begegnung, einmaliger Ablauf |
| `lose` | Unterlegene Figur, einmaliger Ablauf |

Ein Clip besteht aus einer geordneten Liste vorhandener Frame-Namen und einer
Geschwindigkeit `fps` in Bildern pro Sekunde. Dieses Beispiel ist der Inhalt
eines einzelnen Figureneintrags wie `pieces.own.rock`:

```json
{
  "frame": "stein-ruhig",
  "animations": {
    "idle": { "frames": ["stein-ruhig", "stein-blinzelt"], "fps": 2 },
    "selected": { "frames": ["stein-hell-1", "stein-hell-2"], "fps": 5 },
    "move": { "frames": ["stein-geht-1", "stein-geht-2"], "fps": 8 },
    "duel": { "frames": ["stein-duell-1", "stein-duell-2"], "fps": 6 },
    "attack": { "frames": ["stein-angriff-1", "stein-angriff-2"], "fps": 8 },
    "win": { "frames": ["stein-sieg-1", "stein-sieg-2"], "fps": 6 },
    "lose": { "frames": ["stein-verlust-1", "stein-verlust-2"], "fps": 6 }
  }
}
```

Alle hier verwendeten Namen müssen zuvor in `atlas.frames` eingetragen sein.
Ein nicht angegebener Zustand verwendet die verfügbare Standarddarstellung der
Figur. Bei ausgeschalteten Animationen wird ihr statischer `frame` benutzt.

Die Dauer der Bewegung zwischen zwei Feldern steht unabhängig von der
Bildwechselgeschwindigkeit unter:

```json
"motion": { "moveMs": 180, "battleMs": 900 }
```

`moveMs` ist eine Dauer in Millisekunden zwischen 0 und 1000. Der Wert 0 schaltet
die Bewegung zwischen Feldern aus; der Animationsschalter und reduzierte
Bewegung bestimmen zusätzlich, ob Figurenclips laufen. Kurze Bewegungen um
150–250 Millisekunden lassen Züge gut erkennen, ohne den Ablauf zu verlängern.
`battleMs` legt die Basisdauer des Kampfeffekts direkt an den Brettfiguren zwischen 100 und 2000
Millisekunden fest; ohne Angabe sind es 900 Millisekunden. Längere eigene
Angriffs- oder Ergebnisclips können die jeweilige Phase verlängern, damit
ihre Bildfolge vollständig gezeigt wird. Ein neuer bestätigter Zug kann die
alte Darstellung jederzeit ablösen. Die Darstellung zeigt
das vom Server bereits bestätigte Ergebnis. Die Animation bestimmt weder den
Gewinner noch die Aufdeckung geheimer Informationen. Das zusätzliche zentrale
Kampfoverlay hat in v0.4.7 eine nominelle Animationsdauer von 3000 Millisekunden
und nutzt dieselbe Animationseinstellung. Es wartet jeweils auf das Ende der
vorherigen CSS-Phase, damit der erste SVG-Aufbau nicht von unabhängig laufenden
Phasentimern überholt wird. `battleMs` ändert diese Dauer nicht.

## 6. Prüfung und Rückfall auf Klassisch

Der Browser prüft den Katalog, die Grafikdefinition, die Verweise und das Bild.
Beispielsweise werden ungültige Farben, fehlende referenzierte Frames und
Ausschnitte außerhalb des Bildes erkannt. Grenzen für ein einzelnes Set:

| Eigenschaft | Grenze |
| --- | --- |
| JSON-Datei | 256 KiB |
| Atlas | Je Haupt- oder Waffenatlas höchstens 4096 Pixel breit und 4096 Pixel hoch |
| Anzahl Frames | Höchstens 512 je Atlas |
| Frames pro Animationsclip | Höchstens 64 |
| Animationsgeschwindigkeit | 1–30 Bilder pro Sekunde |
| Ladezeit einer Bilddatei | 10 Sekunden |

Eine nicht verwendbare Hauptgrafik wird zuerst durch `atlas.fallbackImage`
ersetzt, sofern eine solche Datei angegeben und verwendbar ist. ICQ Retro
bleibt dabei mit seinen PNG-Bildern aktiv. Wenn der Katalog, die Grafikdefinition
oder alle angegebenen Hauptbilder nicht geladen oder geprüft werden können,
erscheint ein deutscher Hinweis und die Oberfläche verwendet das integrierte
Klassikdesign. Die Partie und ihre Verbindung bleiben erhalten. Ein alleiniger
Ladefehler eines optionalen separaten Waffenbildes verwendet weiterhin die
entsprechenden Waffen-Frames des geladenen Hauptatlas.

Unterscheide diese Fälle:

- **Eine Datei fehlt im eigenen NAS-Ordner:** Der Server versucht die gleichnamige
  eingebaute Datei.
- **Das primäre Hauptbild ist nicht verwendbar:** Der Browser versucht die
  konfigurierte `fallbackImage` mit denselben Frames.
- **Die Grafikdefinition oder alle angegebenen Hauptbilder sind ungültig:** Der
  Browser meldet das Problem und verwendet das integrierte Klassikdesign. Die
  fehlerhafte Definition wird nicht still mit der eingebauten JSON-Datei vermischt.
- **Nur das optionale Waffenbild ist nicht verwendbar:** Die entsprechenden
  Waffenbilder des Hauptatlas erscheinen, das gewählte Grafikset bleibt aktiv.

Wenn eine Bearbeitung nicht sichtbar wird, prüfe zuerst:

1. Liegt die Datei unter dem eigenen `skins`-Ordner und stimmt Groß-/Kleinschreibung?
2. Verweist `skins/index.json` auf den richtigen Set-Ordner und die richtige Datei?
3. Ist die bearbeitete Datei unter `atlas.image`, `atlas.fallbackImage` oder
   `weaponAtlas.image` eingetragen, und passen die Rechtecke zu diesem Bild?
4. Wurde die Spielseite nach dem Speichern neu geladen?

Bei ICQ Retro liefert normalerweise `atlas.svg` sämtliche Bildmotive.
Eine Änderung nur an `atlas.png` verändert zunächst die Rückfallgrafik.
Bearbeite die passenden Quellen und erzeuge SVG, PNG und Manifest mit dem
vollständigen Grafikbuild gemeinsam neu. Das gilt auch für Änderungen nur
an `weapon-atlas.svg` oder an `public/skins/icq-retro/source/referees.svg`.

Du kannst die aktuelle Serverdatei direkt im Browser ansehen, beispielsweise
unter [dem Grafikkatalog](https://flusensieb.dns.navy:8443/skins/index.json) oder
`https://flusensieb.dns.navy:8443/skins/mein-design/atlas.svg`.

## 7. Eigene Grafiksets bei späteren Spielupdates behalten

Deine eigenen Dateien bleiben im NAS-Ordner
`/share/Container/rps-arena/rps-remake/skins`.

1. Entpacke das neue vollständige Spiel-ZIP zunächst in einen anderen Ordner.
2. Kopiere die aktualisierten Projektdateien in den bestehenden Projektordner.
   **Lasse dabei den `skins`-Ordner aus dem neu entpackten ZIP aus und behalte den
   vorhandenen NAS-Ordner `skins`.** Der neue ZIP-Ordner enthält lediglich den
   allgemeinen Hinweis; deine eigenen Dateien haben Vorrang.
   Ebenso bleiben die vorhandene `.env` und der lokale Ordner `secrets` erhalten.
3. Baue und starte das aktualisierte Projekt zwischen zwei Partien mit den
   Befehlen aus [QNAP-UPDATE.md](QNAP-UPDATE.md).

Der Build verwendet `public/skins` für die eingebauten Sets. Der eigene Ordner
`skins` wird nicht in das Image kopiert. Seine Inhalte bleiben über den
schreibgeschützten Mount verfügbar. Solange dessen Pfad gleich bleibt, musst du
deine Bilder nach einem Containerwechsel nicht erneut importieren.

Im eigenen Ordner werden ausschließlich Grafikdateien und die zugehörigen
JSON-Dateien abgelegt. Die Dateien sind unter `/skins/` für Mitspieler erreichbar;
Passwörter, Sicherungen und andere NAS-Daten gehören in einen anderen Ordner.

## 8. Direkter Node-Start und Entwicklungsmodus

Ohne Docker kannst du den eigenen Ordner beim Start als Umgebungsvariable
angeben. Die vollständige Oberfläche muss dafür bereits gebaut sein:

```sh
SKINS_DIR=./skins npm start
```

Unter PowerShell:

```powershell
$env:SKINS_DIR = "./skins"
npm start
```

Der Node-Server liest Prozessvariablen; eine `.env`-Datei wird dafür nicht
automatisch eingelesen.

Bei `npm run dev` liefert Vite auf Port 5173 die Dateien aus `public/skins`.
Eigene Dateien aus `SKINS_DIR` werden nur vom Node-Spielserver auf Port 2567
ausgeliefert; für `/skins` ist kein Vite-Proxy eingerichtet. Bearbeite für die
Vite-Vorschau die Vorlagen unter `public/skins`, oder prüfe den eigenen
NAS-Ordner über einen Produktionsbuild mit `npm start` auf Port 2567.
