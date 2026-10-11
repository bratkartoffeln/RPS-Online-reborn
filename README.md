# RPS Arena – Prototyp v0.2

Ein eigenständiges Browser-Remake des taktischen Stein-Papier-Schere-Prinzips:
zwei Spieler, verdeckte Figuren, eine Flagge und eine Falle pro Seite. Diese
Version funktioniert lokal und im LAN und enthält nun die Vorbereitung für
den Onlinebetrieb. **Eine Internetadresse wurde noch nicht bereitgestellt.**

## Neu in Version 0.2

- Render-Blueprint für eine einzelne Docker-Webinstanz in Frankfurt.
- Geprüfte Bereitschafts- und Versionsantwort für den Hostingdienst.
- Verständliche Beendigung bei Serverneustart oder abgelaufenem Raum;
  vorübergehende Netzwerkstörungen bleiben wiederaufnehmbar.
- Automatische Prüfung einer lokalen oder bereitgestellten Version mit zwei
  Spielverbindungen: `npm run check:online -- https://DEIN-DIENST.onrender.com`.
- Containerprüfung und GitHub-Workflow einschließlich Produktionsstart.

**Der vollständige Weg zur Onlineadresse steht in [ONLINE-START.md](ONLINE-START.md).**
Die Spielregeln und das grundlegende Layout bleiben gegenüber v0.1 gleich.

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

- Name eingeben und einen Raum erstellen.
- Einen **neuen** Browser-Tab öffnen und dort den Einladungslink einfügen.
  Einen vorhandenen Tab nicht per „Tab duplizieren“ kopieren: Browser können
  dabei den Sitzungsspeicher mitkopieren. Zwei unterschiedliche Browser oder
  ein normales und ein privates Fenster funktionieren ebenfalls.
- Zweiten Namen eingeben und dem Raum beitreten. Groß-/Kleinschreibung des
  Raumcodes ist relevant.
- Eigene Figuren durch Anklicken zweier eigener Felder tauschen oder
  „Mischen“ verwenden. Danach auf beiden Seiten „Ich bin bereit“ wählen.
- Der Raumersteller beginnt. Eigene Figur und anschließend ein markiertes
  Zielfeld anklicken. Pfeiltasten und Enter/Leertaste sind ebenfalls möglich,
  wenn das Spielfeld fokussiert ist.

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
- Spielende, Aufgeben und Revanche nur bei Zustimmung beider Seiten.
- Pause bei Verbindungsabbruch. Standardmäßig bleibt der Platz **120 Sekunden**
  für die bisherige Sitzung reserviert; Neuladen im selben Tab kann die Partie
  innerhalb dieses Fensters fortsetzen. Eine erneute erfolgreiche Verbindung
  erzeugt einen neuen Rückkehrtoken.
- Selbst gezeichnete Vektorsymbole; keine externen Grafik- oder Font-CDNs.
- Regeltests und Integrationstests mit echten Colyseus-Clients.

## Vorläufige Regeln

Dies ist ein **spielbarer Prototyp**, noch keine vollständig verifizierte
1:1-Rekonstruktion aller historischen ICQ-Sonderregeln. Folgende Regeln sind
bewusst konkret festgelegt und stehen zentral in `shared/game.ts`:

| Bereich | Festlegung |
| --- | --- |
| Brett | 7 Spalten × 6 Reihen |
| Armee | Je 4 Stein, 4 Papier, 4 Schere, 1 Flagge, 1 Falle |
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

Vor allem Verhalten der Falle, dauerhafte Sichtbarkeit, Waffenverteilung,
Startspieler und Regeln gegen Endlosschleifen sollen wir nach deinem Feedback
mit der gewünschten Originalvariante abgleichen. Ein kompletter Serverneustart
beendet aktuell alle laufenden Partien; Spielstände liegen nur im Speicher.
Nach dauerhaftem Verlassen wird eine Partie beendet. Ein neuer Spieler darf
den alten Platz nicht übernehmen; für einen anderen Gegner einen neuen Raum
erstellen. Räume und Sitzungen sind getrennt, benötigen derzeit kein Konto.

## Projektaufbau

| Pfad | Aufgabe |
| --- | --- |
| `client/main.ts` | Menüs, Spielphasen und Interaktion |
| `client/board.ts` | Phaser-Brett, eigene Symbole, Markierungen und Tastatursteuerung |
| `client/network.ts` | Verbindung, Raumbeitritt, Sitzung und Wiederverbindung |
| `client/styles.css` | Responsives Design |
| `shared/game.ts` | Maßgebliche Spielregeln und Sicht pro Spieler |
| `shared/protocol.ts` | Geteilte Nachrichtentypen |
| `server/RpsRoom.ts` | Colyseus-Raum, validierte Aktionen und private Zustandsnachrichten |
| `server/app.ts` | HTTP-/WebSocket-Server, Spielauslieferung, Health-Endpunkt |
| `server/index.ts` | Serverstart und Netzwerkadressen |
| `tests/game.test.ts` | Fachliche Regel- und Geheimhaltungstests |
| `tests/network.test.ts` | Integration mit getrennten Clients und echten Verbindungen |

Die vollständigen gegnerischen Figuren bleiben im `GameState` des Servers.
`viewFor()` baut für jeden Spieler explizit ein eigenes, gefiltertes `GameView`.
Der private Zustand wird **nicht** dem automatisch synchronisierten
`Room.state` zugewiesen. Für das kleine Brett werden nach Aktionen komplette,
gefilterte Ansichten als `snapshot` gesendet. Colyseus übernimmt Räume, Plätze,
Transport und Wiederverbindung.

Züge tragen eine Spielstandsrevision. Dadurch werden doppelte oder veraltete
Zugbefehle verworfen. Duellwahlen tragen eine Duell-ID und Rundennummer; eine
globale Revisionsprüfung wäre hier falsch, weil beide Spieler gleichzeitig
wählen dürfen. Eine bereits bestätigte Wahl kann nicht geändert werden.

## Weiterentwickeln

```sh
npm run dev
```

Startet den Server auf Port 2567 und Vite auf Port 5173. Spieloberfläche unter
**http://localhost:5173** öffnen. Im Entwicklungsmodus verbindet sie sich mit
demselben Host auf Port 2567. Änderungen am Server starten ihn neu und beenden
damit die aktuellen Partien. Vite aktualisiert die Oberfläche während der
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

- 36 automatisierte Tests bestanden: Spielregeln und Netzwerkabläufe mit
  getrennten Clients, einschließlich Geheimhaltung der Figuren, gleichzeitiger
  Duelleingaben, Wiederbeitritt, Serverneustart und abgelaufenen Sitzungen.
- TypeScript-Prüfung und Produktionsbuild erfolgreich.
- `render.yaml` gegen das offizielle Render-JSON-Schema validiert.
- Den gebauten Server in einer frischen Laufzeit mit `npm ci --omit=dev`
  gestartet: Version, `/ready`, Browserdateien, zwei Spielverbindungen, Zug und
  Wiederbeitritt erfolgreich geprüft. Geordnetes Beenden per `SIGTERM` endet
  mit Exitcode 0. Dafür waren keine TypeScript-Quelldateien nötig.
- Version 0.1 wurde vom Nutzer erfolgreich im Browser und mit zwei physischen
  LAN-Geräten gespielt. Die neuen Statusanzeigen von v0.2 wurden automatisiert,
  noch nicht in einem echten Browser geprüft.
- Die Docker-Engine und ein Render-Zugang stehen in dieser Arbeitsumgebung
  nicht bereit. Der tatsächliche Containerbau und der öffentliche HTTPS-/WSS-
  Test müssen deshalb noch über die mitgelieferten Prüfungen ausgeführt werden.

## Konfiguration

Der Server liest Umgebungsvariablen des Prozesses; `.env.example` dokumentiert
die Werte. Eine Datei `.env` wird nicht automatisch geladen.

| Variable | Standard | Bedeutung |
| --- | --- | --- |
| `PORT` | `2567` | HTTP und WebSocket auf demselben Port |
| `HOST` | `0.0.0.0` | Für das LAN erreichbar; `127.0.0.1` beschränkt auf denselben Rechner |
| `RECONNECT_SECONDS` | `120` | Rückkehrfenster, 1 bis 600 Sekunden |
| `ALLOWED_ORIGINS` | leer | Optional: zugelassene Browser-Ursprünge für WebSocket, kommasepariert |
| `VITE_SERVER_URL` | automatisch | Optionaler Server-Ursprung für die Client-Entwicklung; Vite liest seine `.env`-Dateien |

Beispiel für PowerShell:

```powershell
$env:PORT = "3000"
npm start
```

## Internetbetrieb

Dieselben Dateien können auf einen Host mit einem dauerhaft laufenden
Node.js-Prozess umziehen. Browserdateien und Multiplayer laufen auf derselben
Domain. Für den öffentlichen Zugriff HTTPS und WSS über den Host beziehungsweise
einen Reverse Proxy einrichten, der WebSocket-Upgrades unterstützt.

Eine Dockerdatei mit Tests, Produktionsbuild und Bereitschaftsprüfung ist enthalten:

```sh
docker build -t rps-arena .
docker run --rm -p 2567:2567 rps-arena
```

`render.yaml` konfiguriert die Bereitstellung; `ONLINE-START.md` beschreibt
GitHub, Render, Kosten, Prüfung und spätere Updates. Der Dockerbau wurde in
dieser Umgebung nicht ausgeführt. Es gibt noch keinen bereitgestellten Internetserver,
keine Konten, öffentliche Spielersuche, Rangliste, KI oder dauerhafte
Spielstanddatenbank. Diese Funktionen sind getrennte Ausbauschritte.

## Technische Referenzen

- Phaser: https://phaser.io/why-phaser
- Colyseus-Räume: https://docs.colyseus.io/room
- Wiederverbindung: https://docs.colyseus.io/room/reconnection
- Bereitstellung: https://docs.colyseus.io/deployment

Die eingesetzten Paketstände stehen fest in `package.json` und
`package-lock.json`; `npm ci` installiert genau den geprüften Abhängigkeitsbaum.
