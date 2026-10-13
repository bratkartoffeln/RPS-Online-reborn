# QNAP: RPS Arena auf Version 0.4.8 aktualisieren

Diese Anleitung aktualisiert dein bestehendes Projekt **rps-arena** mit dem
bereits funktionierenden HTTPS über Caddy und dynv6. Sie verwendet deinen
Projektpfad:

```text
/share/Container/rps-arena/rps-remake
```

Die Spieladresse bleibt **https://flusensieb.dns.navy:8443**. Die vorhandene
Weiterleitung **extern 8443 → NAS 18443 → Caddy 443** und der gespeicherte
dynv6-Token werden weiterverwendet. Für dieses Update sind weder ein neuer Token
noch zusätzliche Routerfreigaben nötig. Die auf deinem NAS vorhandene
Docker-Compose-Version **v2.29.1-qnap2** unterstützt die verwendete Konfiguration.

## 1. Vollständige Version übernehmen

1. **RPS-Arena-v0.4.8-komplett.zip** zunächst in einen separaten Ordner entpacken. Die ZIP
   enthält den vollständigen Projektordner `rps-remake`.
2. Den vollständigen aktualisierten Quellstand in den vorhandenen Projektordner auf dem
   NAS kopieren und gleichnamige Programmdateien ersetzen. Dabei den vorhandenen
   Ordner **`skins`**, den Ordner **`secrets`** und die eigene **`.env`** behalten;
   diese lokalen Inhalte nicht durch Ordner aus der ZIP ersetzen.
3. Der Inhalt muss direkt unter `rps-remake` liegen, beispielsweise
   `rps-remake/compose.yaml`. Es darf kein zusätzlicher Unterordner
   `rps-remake/rps-remake` entstehen.

Die ZIP enthält weder deine `.env` noch `secrets/dynv6_api_token`.
`.env.example` ist eine Vorlage und ersetzt keine vorhandene Konfiguration.
Der bisherige Token muss unter `secrets/dynv6_api_token` mit seinen bestehenden
Dateirechten erhalten bleiben. Die eingebauten Grafiken liegen in
`public/skins` und gehören zu den zu aktualisierenden Programmdateien. Dazu
gehören jetzt insbesondere `icq-retro/atlas.svg`, `icq-retro/atlas.png` und die
zugehörige `skin.json`. Die vorhandene Caddy-Konfiguration bleibt verwendbar.
Der Raumchat benötigt außerdem die neuen Browser-, Server- und gemeinsamen
Quelldateien. Übernimm deshalb den vollständigen Programmstand einschließlich
`client`, `server`, `shared`, `public`, `scripts` und der beiden Paketdateien.

**Den Versionswechsel zwischen zwei Partien durchführen.** Spielstände,
Serienwertungen und Chatverläufe liegen im Arbeitsspeicher und enden bei einem Serverneustart.
Ein Wiederbeitritt erhält sie nur, solange derselbe Raum auf dem Server weiterläuft.

## 2. Spiel und Caddy mit derselben Konfiguration neu bauen

Verwende dieselbe Administrations-SSH-Shell wie beim erfolgreichen Aufbau.
Falls du noch in einer normalen Benutzershell bist, öffne sie zunächst mit
`sudo -i`. Ohne die bisher verwendeten Rechte kann QNAP erneut
`container-station/homes: permission denied` melden.

```sh
cd /share/Container/rps-arena/rps-remake
docker compose -p rps-arena -f compose.yaml -f compose.dns.yaml --profile https up -d --build --wait --wait-timeout 120
docker compose -p rps-arena -f compose.yaml -f compose.dns.yaml --profile https ps
```

**Beide Compose-Dateien in dieser Reihenfolge verwenden.** `compose.dns.yaml`
ergänzt den DNS-01-Betrieb und beschränkt Caddy auf den bestehenden HTTPS-Port.
Der feste Projektname `rps-arena` hält die vorhandenen Container und Volumes im
gleichen Projekt. Der Spielcontainer soll anschließend **healthy** melden;
Caddy soll laufen. `--wait` wartet nach dem Build auf die Bereitschaft; die Zeit
für den Build kommt hinzu.

Die bestehenden Volumes `rps-arena_caddy_data` und `rps-arena_caddy_config`
werden weiterverwendet und enthalten die Zertifikatsdaten. Für das Update ist
kein `down` erforderlich; die Volumes nicht löschen und kein `down -v` ausführen.

Falls der Start fehlschlägt, die Fehlermeldung und die letzten Protokollzeilen
prüfen:

```sh
docker compose -p rps-arena -f compose.yaml -f compose.dns.yaml --profile https logs --no-color --tail=100 rps caddy
```

## 3. Onlineprüfung ausführen

```sh
docker compose -p rps-arena -f compose.yaml -f compose.dns.yaml --profile https exec -T rps npm run check:online -- https://flusensieb.dns.navy:8443
```

Die Prüfung muss **Version 0.4.8** erwarten und mit **„Onlineprüfung bestanden“**
enden. Sie prüft unter anderem die ausgelieferte Oberfläche und Grafik-Map,
zwei echte Spielverbindungen, verdeckte Figuren, Serienwertung, gemeinsame
Fortsetzung und Wiederbeitritt mit vorhandenem Punktestand. Dafür erzeugt sie
eine eigene Testpartie und schließt sie anschließend wieder.

Dieser Schritt bestätigt erst nach dem Update den Betrieb der neuen Version
auf deinem NAS. Die bisherige Installation allein bestätigt noch nicht das
Update auf 0.4.8.

## 4. Design und neue Funktionen im Browser ansehen

1. [Die Spielseite öffnen](https://flusensieb.dns.navy:8443) und vollständig neu
   laden. In der Oberfläche muss **v0.4.8** erscheinen.
2. Unter **Design** im Feld **Dein Design** **ICQ Retro** wählen. Ohne bisher gespeicherte
   Designwahl ist es bereits der Standard. Eine vorhandene Browserwahl bleibt
   erhalten; **Klassisch** und **Arcade** sind weiterhin verfügbar. Die aktive
   Retro-Auswahl ist dunkelolivgrün mit heller Schrift hinterlegt; die anderen
   Optionen erscheinen dunkel auf hell.
3. Beim Erstellen eines Raums **Freie Serie**, **Best of 3** oder **Best of 5**
   wählen. Best of 3 endet bei zwei Siegen, Best of 5 bei drei. Unentschiedene
   Partien werden separat gezählt. Nach jeder Partie wechselt der Startspieler.
4. Nach dem Spielende stimmen beide Spieler der **Nächsten Partie** oder einer
   **Neuen Serie (0 : 0)** zu. Ist eine Best-of-Serie entschieden, beginnt mit
   beider Zustimmung eine neue Serie. Der Modus bleibt dabei erhalten.
5. In der Retro-Spielansicht steht der Schiedsrichter direkt in der Statuskarte
   an der Stelle der bisherigen textlichen Zuganzeige. Während normaler Züge
   zeigt er die feste Farbe des Zugspielers: Der Raumersteller auf Seat 0 ist
   in beiden Browsern blau, der zweite Spieler auf Seat 1 rot. Nach einem Sieg
   zeigt er die Gewinnerfarbe. Die aktive Flagge weist je Browser auf die
   passende Seite: unten für den eigenen Spieler, oben für den Gegner. Der Schiri
   ist mit 180 × 135 Pixeln größer dargestellt. Namen, Spielstand und Figuren
   folgen derselben Farbzuordnung; deine eigene Armee steht weiterhin unten von hinten, der Gegner oben von vorn.
   Im Duell und bei einem Remis sind beide Flaggen sichtbar. Nach der öffentlichen
   Aufdeckung halten deine blauen oder roten Stein-, Papier- und Scherenfiguren das Werkzeug
   vorn oder seitlich in einer Hand mit tiefer, natürlicher Armhaltung.
   Die Fallen beider Seiten sind wieder goldgelb, in SVG und PNG. Zusätzliche
   gelbe Aufdeckpunkte erscheinen im Retro-Design weiterhin nicht.
   Die Zielflaggen sind getauscht: bei der blauen Mannschaft ein rotes Tuch,
   bei der roten ein blaues. Die Spielerzuordnung und die Schiri-Flaggen bleiben
   davon unabhängig.
6. In der Regelerklärung sind Stein, Papierrolle und Schere als einzelne Bilder
   sichtbar. Bei gleichen Waffen erscheinen die drei größeren Motive mittig
   über dem Spielfeld mit der Überschrift **„Wähle deine Waffe“**. Waffenwahl
   und Gefecht haben jeweils eine gemeinsame, leicht transparente Hintergrundfläche.
   Sie ist bei Klassisch und Arcade zu 85 Prozent deckend, bei ICQ Retro zu 92 Prozent.
   Die Waffen, Texte und Bedienelemente bleiben vollständig deckend, auch nach
   bestätigter Auswahl. Deine Wahl bleibt geheim; bei erneutem Gleichstand
   öffnet sich dort die nächste Runde.
7. Bei jedem Kampf treffen die beiden Waffen im Overlay aufeinander. Die vier
   Phasen dauern zusammen nominell 3 Sekunden; nach bestätigter Waffenwahl liegt
   davor eine Pause von 600 Millisekunden. Auf eine kurze Kampfwolke folgen
   die zerbrechende Verliererwaffe und der hervorgehobene
   Sieger. Anschließend hüpft die gesamte verbliebene Gewinnerarmee kurz auf
   dem Brett. Derselbe Spieler und dieselbe Farbe gewinnen in beiden Browsern.
8. Bei einer echten Flaggeneroberung erscheint im Retro-Design der erfolgreiche
   Kämpfer lächelnd von vorn mit erhobener eroberter Flagge. Beide Browser zeigen
   diese Vorderansicht. Der blaue Sieger hält ein blaues Tuch, der rote ein rotes;
   die bisherigen Zielflaggen sind weiterhin getauscht. Alle verbliebenen
   Siegerfiguren springen viermal gemeinsam. Danach bleibt der Fahnenträger
   bis zur nächsten Partie auf dem Zielfeld stehen.
9. Unter dem Spielfeld im **Chat** eine Nachricht mit Enter oder **Senden**
   abschicken. Beide Teilnehmer sehen Name, feste Teamfarbe und Nachricht.
   Bis zu 300 Unicode-Zeichen sind möglich; bei Sendefehlern bleibt der Entwurf
   erhalten. Die letzten 50 Nachrichten bleiben über die nächste Partie,
   neue Serien und Wiederverbindungen desselben Raums verfügbar. Ein neuer
   Raum beginnt leer; ein Serverneustart löscht den bisherigen Raumverlauf.

ICQ Retro verwendet jetzt einen vollständigen **SVG-Atlas mit 43 Motiven auf
einer Zeichenfläche von 2016 × 2016**: Brett, beide Farben und Blickrichtungen einschließlich Aufdeckposen,
Logo, fünf Schiedsrichterposen, drei Einzelwaffen und zwei Flaggensieger. Die
bisherigen 41 Ausschnittpositionen bleiben erhalten. Kann die SVG nicht
verwendet werden, lädt das Set automatisch die aus derselben SVG neu exportierte PNG.
Die beiden Dateien und ihre gemeinsame `skin.json` gehören deshalb zusammen.
Auch Arcade verwendet seine `master.svg` mit passender PNG-Rückfallgrafik;
die vorhandenen 147 Frames und Animationsclips bleiben erhalten.
Das Brett berücksichtigt weiterhin die Bildschirmdichte bis Faktor 2. Nach dem
Verschieben auf einen Monitor mit anderer Pixeldichte die Seite neu laden,
damit der Zeichenpuffer dazu passt.

Die Aufdeck-, Flaggen- und Siegerposen sowie die Waffenbilder funktionieren auch bei
abgeschalteten Animationen. Unter **Design → Animationen** lassen sich Kampf-
und Sprungbewegungen ausschalten; eine Systemeinstellung für reduzierte Bewegung
hat Vorrang. Dann erscheint das statische Kampfergebnis für 350 Millisekunden,
die Flaggensiegerpose bleibt anschließend ohne Sprünge stehen und die zentrale
Waffenwahl bleibt bedienbar. Die neuen Siegerbilder gehören zum mitgelieferten
Atlas. Die vorhandene Caddy-Konfiguration bleibt für dieses Update verwendbar.

Fehlt **ICQ Retro** in der Auswahl und existiert auf dem NAS ein eigener
`skins/index.json`-Katalog, ergänze darin den neuen Eintrag. Das vollständige
Beispiel steht in [GRAFIKSETS.md](GRAFIKSETS.md). Eigene Grafikdateien unter
`skins` lassen sich weiterhin ohne Containerneubau ändern.

Die vollständige Beschreibung der bestehenden HTTPS-Einrichtung bleibt in
[QNAP-HTTPS.md](QNAP-HTTPS.md) verfügbar.
