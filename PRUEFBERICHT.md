# Prüfbericht – RPS Arena v0.4.7

Stand: 12. Oktober 2026. Diese Lieferung ergänzt die Flaggensiegerpose im
ICQ-Retro-Design, einen einfachen Raumchat sowie die überarbeiteten Hintergründe
und längeren Zeiten der Kampf-Overlays.

## Automatisierte Prüfung und Produktionsbuild

| Prüfung | Ergebnis |
| --- | --- |
| Gesamte automatisierte Testsuite | npm test: **201 bestanden**, keine Fehler, keine übersprungenen Tests. |
| Client und Server | Beide TypeScript-Prüfungen über npm run check erfolgreich. |
| Produktionsbuild | npm run build erfolgreich: Browserbuild, SVG-Komprimierung und Serverdateien erzeugt. |
| Projektversion | package.json und beide Projektversionsfelder der package-lock.json stimmen auf **0.4.7** überein. Abhängigkeiten unverändert gegenüber 0.4.6. |
| Browser-Einstieg | index.html verweist auf **index-0Y3h4WlI.js**, **index-r2TgmBuY.css** und den weiterhin verwendeten Phaser-Baustein. Keine alten Einstiegsdateien im Build. |
| Lokale Bereitschaft | Der gebaute Server antwortet auf /ready mit HTTP 200, ok: true und version: **0.4.7**. |

Die neuen Prüfungen betreffen Zeit- und Lebenszyklussteuerung des Gefechts,
den getrennten Chatkanal, Nachrichtenvalidierung, Wiederverbindungen sowie die
Zuordnung und Rücksetzung der Flaggensiegerpose. Quell- und Buildfassung des
Retro-Atlas stimmen bytegenau mit der verifizierten Referenz überein.

## SVG-Atlas und PNG-Fallback

Der Retro-Atlas enthält jetzt **43 Motive auf 2016 × 2016**. Zwei neue, nativ
gezeichnete SVG-Motive zeigen den Fahnenträger von vorn mit fröhlichen Augen,
breitem Lächeln und erhobener eroberter Flagge.

| Motiv | Ausschnitt x / y / Breite / Höhe |
| --- | --- |
| blue-front-flag-victory | 1448 / 1736 / 272 / 272 |
| red-front-flag-victory | 1736 / 8 / 272 / 272 |

Die Quelle liegt in design/icq-retro-source/flag-victory.svg. Das optionale
Feld flagVictoryFrames ordnet die Motive anhand der festen Spielerfarbe zu,
unabhängig von der Blickrichtung des jeweiligen Browsers.

**Alle 41 bisherigen Ausschnitte behalten ihre Koordinaten und ihre RGBA-Pixel
exakt bei.** Das schließt die bereits getauschten Zielflaggen, goldgelben Fallen,
Aufdeckposen, Einzelwaffen und Schiedsrichterposen ein. Ein blauer Sieger hält
das zuvor blaue Tuch der roten Zielfigur; der rote Sieger hält das zuvor rote
Tuch der blauen Zielfigur.

Die SVG wurde vollständig als XML eingelesen und auf reine Vektormotive geprüft.
Die PNG wurde vollständig dekodiert, auf ihr Dateiende geprüft und mit einer
erneuten SVG-Rasterung verglichen. Beide verwenden dieselben Frame-Rechtecke.
Die geprüfte SVG umfasst 9.943.910 Bytes, die PNG 1.653.528 Bytes. Der Export
prüft den vollständigen PNG-Puffer vorab und veröffentlicht die fertigen
Grafikdateien über temporäre Dateien, Dateisynchronisierung und atomaren Ersatz.

## Raumchat

Der Chat liegt im Spielraum direkt unter dem Spielfeld, mit Nachrichtenverlauf,
Texteingabe und Senden-Schaltfläche. Enter sendet ebenfalls. Die Serverprüfungen
verwenden echte Verbindungen von zwei Teilnehmern und einen zusätzlichen,
getrennten Raum.

Geprüft wurden:

- Name, Spieler-ID, Sitz, Zeit und Nachrichten-ID stammen ausschließlich vom
  Server; mitgeschickte falsche Autorendaten werden nicht übernommen.
- Leere, ungültige und zu lange Nachrichten werden über den eigenen
  Chatfehlerkanal abgewiesen. 300 Unicode-Codepoints sind zulässig.
- Der Mindestabstand beträgt 500 Millisekunden je Spieler. Bereits bestätigte
  Kennungen desselben Spielers erzeugen im gespeicherten Verlauf kein Duplikat.
- Die letzten 50 Nachrichten bleiben im selben Raum über Partien, Serien und
  Wiederverbindungen erhalten. Ein anderer Raum erhält einen eigenen Verlauf.
- Chat verändert weder Spielrevision noch letzte Spielaktion und überträgt
  keine geheimen Duellwahlen.
- Ein verbundener Teilnehmer kann bei pausiertem Gegner und nach Partieende
  schreiben. Nach der terminalen Servermeldung wird kein Chat mehr angenommen.
- Späte Chatnachrichten und Chatfehler einer alten Verbindung können nicht in
  den nächsten Raum gelangen.

Im Browser wurden echte Sendungen mit Enter und Schaltfläche sowie ihre
Bestätigungen geprüft. Nach einer erfolgreichen Sendung wird nur der
unverändert gebliebene Eingabetext geleert. Ein vor Eintreffen der Bestätigung
weitergeschriebener Entwurf bleibt erhalten. Spielstandsübertragung,
eingehende Nachricht und neu erscheinende Waffenwahl erhalten Eingabeknoten,
Entwurf, Auswahlbereich und Tastaturfokus.

Ein Nachrichtentext mit HTML-ähnlichem Inhalt blieb reiner Text; es entstand
kein HTML-Element und kein ausgeführtes Skript. Beide Browser zeigten dieselben
Nachrichten, Namen und festen Teamfarben.

Bei **1440, 390 und 320 Pixel Fensterbreite** lagen Verlauf, Eingabe und
Senden-Schaltfläche unter dem Brett innerhalb der Spielkarte. Es gab keinen
horizontalen Seitenüberlauf. Die 320-Pixel-Ansicht wurde zusätzlich visuell
kontrolliert.

## Gemeinsame Overlayflächen und Kampfzeiten

**Sechs gezielte Panelprüfungen** wurden im aktuellen Browserbuild durchgeführt.

| Design | Geprüfte Zustände | Gemessener Hintergrund-Alpha |
| --- | --- | --- |
| ICQ Retro | Waffenwahl auf Desktop und bei 320 Pixel Breite | 0,92 |
| Klassisch | Waffenwahl und Gefecht | 0,85 |
| Arcade | Waffenwahl und Gefecht auf schmalen Ansichten | 0,85 |

Das Panel verwendet eine Hintergrundfarbe mit Alpha. Die Deckkraft der
geprüften Waffen, Texte, Buttons und ihrer Vorfahren beträgt **1**. Die
Textbereiche liegen innerhalb der gemeinsamen Fläche, ohne zusätzliche
Hintergrundkacheln. Die Panelgrenzen und sichtbaren Inhalte passen ins
jeweilige Brett. Die Klassisch-Gefechtansicht wurde zusätzlich visuell geprüft.

Die normale Kampfanimation verwendet nominell **600 / 600 / 700 / 1100
Millisekunden**, insgesamt **3 Sekunden**. Ein echtes, von beiden Teilnehmern
über die Oberfläche aufgelöstes Duell zeigte zuvor die gesperrte eigene Wahl,
ohne gegnerische Waffe im Übergangs-Overlay. Anschließend erschienen
Annäherung, Aufprall, Zerbrechen und Siegerhervorhebung in der richtigen Reihenfolge.
Die gemessenen CSS-Dauern stimmen mit den vorgesehenen Werten überein.

Die programmierte Pause beträgt **600 Millisekunden**. Im verwendeten
Software-Renderer wurden bis zum beobachteten Beginn der Kampfszene etwa
655 beziehungsweise 721 Millisekunden gemessen. Die Phasen folgen dem Ende
der tatsächlichen CSS-Animation; zusätzliche Renderzeit kann den Ablauf
verlängern. Dies ist keine FPS-Messung oder Zusage einer festen Echtzeitdauer
auf jedem Gerät.

Die ausdrücklich gewünschte Zerstörung blendet die Verliererwaffe und ihre
Fragmente während der Animation aus. Das ist unabhängig von der Deckkraft
der gemeinsamen Hintergrundfläche.

## Flaggensieg in beiden Browserperspektiven

Vier kontrollierte Flaggeneroberungen wurden über die vorhandene
Spieltransition und reguläre Spielstandsübertragung dargestellt. Es wurde
jeweils die echte Board- und Combat-Komponente des Produktionsbuilds verwendet.

| Grafikweg | Gewinner | Bewegung | Perspektiven |
| --- | --- | --- | --- |
| SVG | Blau | Vier gemeinsame Sprünge | Beide Spieler |
| SVG | Rot | Vier gemeinsame Sprünge | Beide Spieler |
| Erzwungener PNG-Fallback | Blau | Vier gemeinsame Sprünge | Beide Spieler |
| Erzwungener PNG-Fallback | Rot | Animationen über die Oberfläche ausgeschaltet | Beide Spieler |

In allen **acht Ansichten** wurde derselbe bestätigte Eroberer in der
passenden Frontpose angezeigt, ohne horizontale oder vertikale Spiegelung.
In den animierten Fällen zeigten alle verbliebenen Gewinnerfiguren vier
Sprungintervalle, der Fahnenträger jeweils höhere Sprünge. Die übrige
Gewinnermannschaft hob gleichzeitig ab und landete gleichzeitig. Gegner
bewegten sich nicht. Nach dem Jubel standen alle Figuren wieder exakt auf
ihren Brettpositionen; die Siegerpose blieb sichtbar.

Im ausgeschalteten Zustand blieb die rote Siegerpose vollständig statisch.
Dieser Fall prüft ausdrücklich den UI-Schalter „Animationen“. Eine zusätzlich
emulierte Betriebssystemeinstellung für reduzierte Bewegung war nicht Teil
dieses Browserlaufs; ihre vorhandene Steuerung bleibt erhalten.

Die SVG-Frontposen beider Farben und die PNG-Pose wurden anhand der Bilder
zusätzlich visuell kontrolliert. Die PNG-Rückfalltests verhinderten die SVG-Antwort
absichtlich; die Anwendung verwendete nachweislich atlas.png. Es wurden keine
JavaScript-Fehler oder unerwarteten fehlgeschlagenen Ressourcenantworten erfasst.

### Nachvollziehbarkeit der Browserprüfung

Die Chat-, Panel- und Duellzeitprüfungen waren im ersten Lauf erfolgreich.
Sein anschließender Hero-Vergleich setzte identische Fließkommawerte voraus
und brach bei einer Rundungsdifferenz von etwa 0,00000000000001 Pixeln ab.
Ausschließlich dieser QA-Vergleich erhielt eine Toleranz von 0,000001 Pixeln.
Die vier Hero-Fälle wurden danach gezielt fortgesetzt; Produktdateien blieben
unverändert.

Die vollständigen Rohdaten und Bilder beider Läufe wurden erhalten. Die
abschließende Auswertung hat alle acht Hero-Datensätze erneut erfolgreich geprüft, einschließlich
Pose, Sprungintervallen, Synchronität, Gegnerpositionen und Endpositionen.
Ein fehlender Abschlussmarker im gespeicherten Hero-Zwischenbericht ist dabei
ausdrücklich dokumentiert; der Zwischenbericht wird nicht als eigener erfolgreicher
Gesamtlauf ausgegeben.

Die Prüfung betrifft Browserfenster mit lokalem Software-Rendering, keine
physischen Mobilgeräte. Frühere umfassende Kampfpaarungsprüfungen werden hier
nicht als neu ausgeführte Tests ausgewiesen.

## Vollständiges Archiv und Installation

**RPS-Arena-v0.4.7-komplett.zip** enthält den vollständigen Projektordner
rps-remake mit Quellcode, gebautem Browser und Server, Grafiken, Tests,
Containerkonfiguration und aktualisierten Anleitungen. Laufzeitabhängigkeiten
unter node_modules und private NAS-Konfiguration gehören nicht in die ZIP.

Zu den Freigabekriterien gehören vollständiges Dekodieren der mitgelieferten
PNG- und SVG-Dateien, ZIP-CRC-Prüfung und ein unabhängiges Entpackprogramm.
Alle vollständig entpackten Dateien werden bytegenau mit den Projektdateien
verglichen. Die gespeicherte Downloadfassung wird zusätzlich mit der vor dem
Upload verifizierten ZIP verglichen.

Die Prüfungen wurden lokal ausgeführt. Die Installation auf dem QNAP erfolgt
mit [QNAP-UPDATE.md](QNAP-UPDATE.md). Nach dem Kopieren und Neubauen müssen
sowohl die Browseroberfläche als auch /ready **0.4.7** melden.
