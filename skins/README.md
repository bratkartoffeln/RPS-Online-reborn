# Eigene Grafiksets für RPS Arena

Dieser Ordner wird von Docker Compose unter `/app/skins` schreibgeschützt in
den Spielcontainer eingebunden. Eigene Dateien überschreiben die gleichnamigen
Dateien der eingebauten Grafiksets. Fehlt eine Datei hier, bleibt die eingebaute
Datei verfügbar.

Die eingebauten Sets **ICQ Retro**, **Klassisch** und **Arcade** liegen unter
`public/skins`. Seit Version 0.4.0 ist ICQ Retro der Standard für Browser ohne
gespeicherte Designwahl. Eine vorhandene Auswahl bleibt erhalten.

Version 0.4.1 ergänzt im Retro-Set statische Posen für aufgedeckte eigene
Kämpfer sowie die Zug- und Sieganzeige des Schiedsrichters. Eigene Sets können
dafür die optionalen Felder `pieces.<team>.<figur>.revealed` und `turnPortraits`
verwenden. Ohne diese Angaben bleiben die bisherigen Bilder nutzbar.
Format und Beispiele stehen in der Grafikset-Anleitung.

Ein eigener `skins/index.json`-Katalog ersetzt den eingebauten Katalog. Ergänze
gewünschte eingebaute Sets deshalb ausdrücklich; die neue Retro-Zeile lautet:

```json
{ "id": "icq-retro", "name": "ICQ Retro", "file": "icq-retro/skin.json" }
```

Dies ist ein einzelner Eintrag für das Feld `skins`, kein vollständiger Katalog.
Die eingebauten Bilddateien müssen dafür nicht hierher kopiert werden.

Die vollständige Anleitung und JSON-Beispiele stehen in
[GRAFIKSETS.md](../GRAFIKSETS.md), der Ablauf für dein bestehendes HTTPS-Projekt
in [QNAP-UPDATE.md](../QNAP-UPDATE.md).

Bei einem späteren Update des Spiels **diesen Ordner mit seinen eigenen Dateien
behalten**. Er gehört zu deinen Daten und wird nicht neu aufgebaut.

Nach einer Änderung der Grafik- oder JSON-Dateien die Spielseite neu laden.
Ein neuer Containerbau ist dafür nicht nötig.

Alles in diesem Ordner ist über `/skins/` im Spielserver öffentlich erreichbar.
Hier gehören ausschließlich die Grafiken und JSON-Dateien der Grafiksets hinein.
