# RPS Arena – alternative Bereitstellung mit Render

Das Projekt enthält zusätzlich die Konfiguration für einen einzelnen Docker-
Webservice auf Render. **Für das bestehende QNAP-Projekt gilt stattdessen
[QNAP-UPDATE.md](QNAP-UPDATE.md).** Ein Render-Dienst wurde für dieses Projekt
nicht eingerichtet. Die Dateien können weiterhin lokal oder im LAN laufen.

## Der erste Schritt bei dir

Entpacke **RPS-Arena-v0.4.13-komplett.zip** in einen eigenen Ordner, öffne `rps-remake` in VS Code
und veröffentliche diesen Ordner als **privates GitHub-Repository**.
Die Datei `render.yaml` muss dabei direkt in der Repository-Wurzel liegen,
neben `package.json` und `Dockerfile`.

In VS Code geht das über die Quellcodeverwaltung: Repository initialisieren,
Dateien committen und auf GitHub veröffentlichen. Wähle ein privates Repository,
beispielsweise `rps-arena`. Git und eine GitHub-Anmeldung werden dafür benötigt.
Die mitgelieferte `.gitignore` schließt Abhängigkeiten, Buildausgaben, lokale
Umgebungsdateien und ZIPs aus. `.github/workflows/verify.yml` gehört ins Repository.

Ist das Projekt bereits in einem Repository, übernimm die aktualisierten Dateien
dort als normalen Commit. Die neue ZIP enthält keine Git-Historie.

## Was schon vorbereitet ist

| Einstellung | Vorbereiteter Wert |
| --- | --- |
| Hosting | Render Web Service, Docker |
| Standort | Frankfurt |
| Compute | `0.5c-512mb`, früher Starter genannt |
| Anzahl | Eine Instanz mit einem Node.js-Prozess |
| Automatische Deploys bei Commits | Aus; Updates gezielt zwischen Partien starten |
| Start | Über das `CMD` im Dockerfile |
| Bereitschaft | `/ready` |
| Erreichbarkeit des Prozesses | `/health` |
| Browser und Spielverbindung | Gemeinsame Adresse; HTTPS und WSS über Render |
| Wiederbeitritt | 120 Sekunden bei vorübergehendem Verbindungsabbruch |

Render setzt den Serverport über `PORT` (standardmäßig 10000). Der Server liest
ihn bereits aus der Umgebung und bindet auf `0.0.0.0`. Deshalb sind weder eine
Änderung im Client noch ein zweiter öffentlicher Port nötig. Eine eigene Domain
ist optional; Render stellt eine `onrender.com`-Adresse mit TLS bereit.

### Kosten vor dem Bereitstellen

Stand der offiziellen Preisangaben am 11.10.2026: Der Hobby-Workspace kostet
0 US-Dollar pro Monat zuzüglich Nutzung. Die konfigurierte Webinstanz kostet
7 US-Dollar pro Monat für Compute. Weitere nutzungsabhängige Beträge können
hinzukommen; der angezeigte Preis im Render-Dashboard ist vor dem Deploy zu
prüfen. Die Konfigurationsdatei allein bestellt keinen Dienst.

Die Vorlage verwendet eine bezahlte Instanz ohne den Leerlauf-Stopp des
Free-Tarifs. Beim Free-Tarif können nach einer Pause die nur im Arbeitsspeicher
liegenden Partien verschwinden. Auch bei einer bezahlten Instanz endet eine
Partie bei einem Serverneustart oder Deployment.

## Auf Render bereitstellen

1. Unter <https://dashboard.render.com/> anmelden und GitHub so verbinden,
   dass Render auf das Projekt-Repository zugreifen kann.
2. Einen neuen **Blueprint** anlegen und dieses Repository auswählen.
   Render übernimmt die Einstellungen aus `render.yaml`.
3. Prüfen, dass genau ein Webservice in Frankfurt mit der oben genannten
   Compute-Instanz und `/ready` als Healthcheck vorgesehen ist. Falls bereits
   ein anderer Dienst namens `rps-arena` existiert, vorab einen anderen Namen
   in `render.yaml` verwenden.
4. Nach Prüfung des angezeigten Tarifs den Blueprint bereitstellen.
5. Warten, bis Build und Start erfolgreich sind. Das Dockerfile installiert
   Abhängigkeiten, führt die automatisierten Tests aus und baut beide Teile
   der Anwendung. Der Container startet nur den gebauten Server.
6. Die von Render tatsächlich ausgegebene **HTTPS-Adresse** öffnen. Dort
   sollte RPS Arena 0.4.13 erscheinen. Diese Adresse für Einladungslinks verwenden.

`autoDeployTrigger: off` verhindert automatische Anwendungsdeploys bei jedem
Commit. Änderungen an einem Blueprint können dennoch einen neuen Deploy
erfordern. Updates und Konfigurationsänderungen deshalb zwischen Partien
durchführen; diese Einstellung garantiert keine unterbrechungsfreie Sitzung.

Ein privates GitHub-Repository schützt den Quellcode. Der Render-Webservice
selbst ist öffentlich erreichbar. Die Spielräume werden nicht öffentlich
aufgelistet, sind aber für Personen mit einem freien Raumcode zugänglich.
Ein gesonderter Testerzugang ist in dieser Version nicht enthalten.

## Bereitgestellte Version automatisch prüfen

Im Projektordner einmal `npm ci` ausführen. Danach die tatsächlich ausgegebene
Render-Adresse einsetzen:

```sh
npm run check:online -- https://DEIN-DIENST.onrender.com
```

Die Prüfung kontrolliert Version und Bereitschaft, lädt Startseite und Assets,
erstellt eine eigene Testpartie mit zwei SDK-Clients, prüft die verdeckten
Figuren, führt einen Zug aus und verbindet einen Spieler erneut. Anschließend
schließt sie die Testpartie. Andere Räume werden nicht verwendet.

Dies prüft HTTP und die tatsächliche Spielverbindung. Es ersetzt keine
Browserprüfung. Für den letzten Praxistest öffnen zwei Spieler die Adresse über
unterschiedliche Internetanschlüsse, spielen eine vollständige Partie und
testen Duell, Revanche, den Raumchat unter dem Spielfeld sowie einmal Neuladen
im selben Tab. Der Chatverlauf desselben Raums bleibt beim Wiederbeitritt erhalten.

## Docker lokal oder automatisch prüfen

Bei laufender Docker Engine bzw. Docker Desktop:

```sh
npm ci
npm run check:docker
```

Das Skript baut ein temporäres Image, startet es auf einem freien lokalen Port,
führt dieselbe Onlineprüfung aus und prüft anschließend das geordnete Beenden
per `SIGTERM`. Testcontainer und Testimage werden danach entfernt. Docker kann
seinen normalen Buildcache behalten.

Der GitHub-Workflow **Verify production container** führt diese Prüfung nach
einem Push oder Pull Request aus; er kann auch manuell gestartet werden.
Er veröffentlicht kein Image und löst keinen Render-Deploy aus. Für die Tests
werden keine eigenen GitHub- oder Render-Secrets benötigt.

Für einen lokalen Docker-Dauerlauf liegt außerdem `compose.yaml` bei:

```sh
docker compose up --build -d
docker compose logs -f
```

Danach wie bisher <http://localhost:2567> öffnen. Beenden:

```sh
docker compose down
```

Compose allein stellt keine Internetadresse oder TLS bereit. Für Render wird
`render.yaml` zusammen mit dem Dockerfile verwendet, nicht `compose.yaml`.

## Updates und Verbindungsunterbrechungen

- **Kurze Netzwerkstörung:** Die Partie pausiert; Wiederbeitritt bleibt möglich.
- **Geordneter Serverneustart:** Der Server meldet das Ende ausdrücklich. Die
  Oberfläche beendet die alte Sitzung und bietet eine neue Partie an.
  Partien, Serienwertungen und Chatverläufe liegen nur im Arbeitsspeicher und
  werden beim Neustart nicht wiederhergestellt.
- **Abgelaufener oder entfernter Raum:** Die alte Einladung wird deaktiviert.
  Ein vorübergehender Transportfehler löscht einen Rückkehrtoken dagegen nicht.
- **Abrupter Prozess- oder Hostausfall:** Eine Shutdown-Nachricht kann ausbleiben.
  Der Verlust wird beim Wiederverbindungsversuch erkannt, sobald der Server
  erreichbar ist und den alten Raum als nicht mehr vorhanden zurückweist.

Neue Versionen nach erfolgreicher Prüfung committen/pushen und im Render-Dienst
über einen manuellen Deploy übernehmen. Währenddessen keine laufende Partie
einplanen. Eine frühere Anwendungsversion kann zurückgerollt werden; verlorene
Spielstände werden dadurch nicht wiederhergestellt.

## Häufige Startprobleme

| Beobachtung | Prüfen |
| --- | --- |
| Docker ist nicht verfügbar | Docker Engine/Desktop starten oder die GitHub-Prüfung verwenden |
| Render findet keinen Port | `HOST=0.0.0.0`, von Render gesetztes `PORT` und Server-Startlog |
| Bereitschaft bleibt fehlerhaft | Buildlog, Vorhandensein von `dist/client`, Healthcheck-Pfad `/ready` |
| Seite lädt, Beitritt scheitert | HTTPS-Adresse verwenden; der Dienst muss WebSockets zulassen |
| Alte Version in der automatischen Prüfung | Den gewünschten Commit manuell bereitstellen, Deployende abwarten |
| Rückkehr nach einem Deploy scheitert | Eine neue Partie erstellen; alte Partien waren nur im Speicher |

## Technische Quellen

- Render-Blueprints: <https://render.com/docs/infrastructure-as-code>
- YAML-Spezifikation: <https://render.com/docs/blueprint-spec>
- Docker: <https://render.com/docs/docker>
- Ports, Domains und TLS: <https://render.com/docs/web-services>
- WebSockets und Prozesswechsel: <https://render.com/docs/websocket>
- Preise: <https://render.com/pricing>
- Workspace-Tarife: <https://render.com/docs/platform-features-by-plan>
- GitHub in VS Code: <https://code.visualstudio.com/docs/sourcecontrol/github>
