# RPS Arena für Android

Die Android-App enthält den gebauten Spielclient sowie die vier Grafiksets und
Spielsounds. Capacitor lädt diese Dateien innerhalb der App unter
`https://localhost`; das ist ausschließlich die lokale Adresse der Oberfläche.
Partien, CPU-Gegner und Raumchat verwenden weiterhin den eingestellten
Colyseus-Spielserver. App- und Browserspieler können dieselben Räume nutzen.

## Auf dem Handy testen

1. Die Datei `RPS-Arena-0.4.35-debug.apk` auf dem Android-Gerät installieren.
2. RPS Arena über das App-Symbol öffnen. Android 7 oder neuer und eine aktuelle
   Android-WebView ab Version 107 sind erforderlich. Für ältere WebViews zeigt
   die App einen lokal mitgelieferten Aktualisierungshinweis.
3. In der Lobby den Spielserver prüfen, einen Namen eingeben und eine Partie
   erstellen oder über Raumcode bzw. Einladungslink beitreten.

Die mitgelieferte Oberfläche funktioniert ohne Netzverbindung. Eine Partie,
einschließlich einer CPU-Partie, benötigt eine Verbindung zum Spielserver.
Bei einem Serverausfall bleibt die Lobby erreichbar und zeigt einen Fehler
beim Verbindungsversuch.

Die APK ist eine signierte Debugversion für Funktionstests. Bei lokal erzeugten
Debug-APKs wird der Debugschlüssel des jeweiligen Entwicklungsrechners
verwendet. Builds von verschiedenen Rechnern oder CI-Läufen können deshalb
unterschiedliche Signaturen besitzen; Android erlaubt dann kein direktes
Update über eine vorhandene Installation. Für eine dauerhafte Veröffentlichung
ist ein eigener, sicher aufbewahrter Releaseschlüssel erforderlich. Private
Schlüssel gehören weder in dieses Repository noch in öffentliche Buildartefakte.

## Spielserver und Einladungen

Die vorbelegte Adresse lautet `https://flusensieb.dns.navy:8443`. Unter
„Spielserver“ in der Lobby kann eine andere HTTPS-Adresse gespeichert werden,
beispielsweise die Domain nach einem Hosting-Umzug. Erlaubt sind HTTPS-Adressen
mit optionalem Port. Zugangsdaten, Pfade, Abfrageparameter und Fragmente sind
keine gültige Serverkonfiguration.

Alternativ setzt `VITE_SERVER_URL` beim Android-Build die vorbelegte Adresse.
Beispiele:

```bash
VITE_SERVER_URL=https://spiel.example.org npm run android:apk
```

```powershell
$env:VITE_SERVER_URL = 'https://spiel.example.org'
npm run android:apk
```

Die zuletzt auf dem Gerät gewählte Adresse hat Vorrang vor der Buildvorgabe.
Einladungen verwenden die öffentliche Serveradresse. Ein Link von einem anderen
Server ändert die Konfiguration nicht automatisch; die App fordert dazu auf,
den passenden Spielserver selbst einzustellen. Gespeicherte Sitzungen sind nach
Server getrennt. Ein Wiederverbindungstoken wird ausschließlich an den Server
gesendet, der diese Sitzung angelegt hat.

### CORS und WebSockets

Der bestehende Server akzeptiert bei leerem `ALLOWED_ORIGINS` bereits den
Android-Ursprung. Wenn eine explizite Liste konfiguriert wurde, muss sie neben
den gewünschten Webadressen auch `https://localhost` enthalten, zum Beispiel:

```dotenv
ALLOWED_ORIGINS=https://spiel.example.org,https://localhost
```

Die HTTP-Matchmaking-Anfragen und die WebSocket-Verbindung müssen diesen Ursprung
akzeptieren. Das vorhandene Colyseus-Matchmaking liefert die nötigen CORS-Header;
die konfigurierte Ursprungsliste schützt den WebSocket-Upgrade. Eine gültige
HTTPS-Verbindung und funktionierende WebSocket-Weiterleitung am Reverse Proxy
sind erforderlich. Die App deaktiviert weder Zertifikatsprüfungen noch die
Android-Sperre für unverschlüsselte Verbindungen.

## Verhalten beim App-Wechsel

Die App pausiert Hintergrundanimationen und Spielsounds. Beim Zurückkehren
synchronisiert sie den Spielstand bzw. setzt die vorhandene Wiederverbindung
fort. Die Reservierungsfrist wird vom Spielserver vorgegeben; die App hält einen
Raum nicht unbegrenzt offen und verlängert diese Frist nicht.

Die Zurück-Geste schließt zunächst offene Dialoge oder Menüs. Während einer
Partie erscheint die vorhandene Rückfrage zum Verlassen des Raums. Die Lobby
kann in den Hintergrund wechseln. Spielernamen und wiederherstellbare Sitzungen
bleiben innerhalb der App erhalten; Android-Backups für diese App sind deaktiviert.

„Vollbild“ zeigt Spielfeld, Schiedsrichter, Spielstand und Spielaktionen zusammen
und blendet die Android-Systemleisten aus. Hoch- und Querformat werden passend
skaliert. „Vollbild beenden“ oder die Zurück-Geste stellt die normale Ansicht samt
Systemleisten wieder her; offene Dialoge werden weiterhin zuerst geschlossen.

## App aktualisieren

Beim Start prüft die App den neuesten stabilen GitHub-Release dieses Repositorys.
In der Lobby unter „App-Updates“ kannst du jederzeit erneut prüfen. Bei einer
neueren Version mit passender APK erscheint „Update herunterladen“. Der Button
öffnet den APK-Download im Android-Browser. Öffne anschließend die heruntergeladene
Datei und bestätige die Installation; Android fragt gegebenenfalls zuerst nach
der Erlaubnis, Apps aus dieser Quelle zu installieren. Die Installation und der
Wechsel aus einer laufenden Partie werden nicht automatisch gestartet.

Die Updatesuche benötigt Internetzugang zu `api.github.com`, der Download zu
`github.com`. Fehler oder GitHub-Ratenlimits verhindern keine Partie. Entwürfe,
Vorabversionen, ältere Versionen und Releases ohne passende APK werden ignoriert.
Automatische Abfragen erfolgen höchstens einmal pro Stunde der laufenden App;
der manuelle Button erlaubt einen erneuten Versuch.

Android übernimmt die vorhandenen App-Daten nur bei gleichem Paketnamen und
gleicher Signatur. Für zukünftige GitHub-Release-APKs deshalb denselben lokalen
Debugschlüssel sicher aufbewahren (`%USERPROFILE%/.android/debug.keystore`);
APK-Artefakte anderer CI-Läufe können anders signiert sein. Ein Wechsel von einer
anders signierten Testversion erfordert einmalig eine Neuinstallation. Die App
umgeht Androids Signaturprüfung nicht.

## Entwicklung und APK-Build

Voraussetzungen:

- Node.js 22.12 oder neuer, empfohlen Node.js 24.
- JDK 21; `JAVA_HOME` muss auf das JDK zeigen.
- Android SDK Platform 36 und Build Tools 36.0.0.
- `ANDROID_HOME` bzw. die lokale `android/local.properties` zeigt auf das SDK.

Das native Projekt und der Gradle-Wrapper werden mitgeliefert. Android Studio
ist für Geräte-Debugging hilfreich; der Kommandozeilen-Build funktioniert ohne
die IDE.

```bash
npm ci
npm run android:apk
```

Dieser Befehl prüft TypeScript, baut die lokale Oberfläche nach `dist/android`,
synchronisiert Capacitor und baut `:app:assembleDebug`. Die APK und ihre
SHA-256-Prüfsumme liegen anschließend in `dist/android-apk/`.

Weitere Befehle:

| Befehl | Zweck |
| --- | --- |
| `npm run build` | Bisherigen Webclient und Spielserver bauen. |
| `npm run build:android` | Nur das gesonderte Android-Webbundle nach `dist/android` bauen. |
| `npm run android:sync` | Android-Webbundle bauen und native Plugins/Assets synchronisieren. |
| `npm run android:open` | Das bestehende Android-Projekt in Android Studio öffnen. |
| `npm run check` | Gemeinsame TypeScript-Prüfung. |
| `npm test` | Spiel-, Netzwerk- und Clienttests. |
| `npm run check:android` | Lokal gebündelte Oberfläche mit separatem Testserver und Browser-Gegner prüfen. |

Für `check:android` müssen zuvor Web- und Android-Bundle gebaut sein.
Der Integrationstest verwendet Playwright/Chromium und ausschließlich lokale
Testserver. OpenSSL muss für das kurzlebige lokale Testzertifikat im `PATH`
verfügbar sein. Einmalig `npx playwright install chromium` ausführen. Mit
`RPS_CHROMIUM_EXECUTABLE` lässt sich stattdessen der vollständige Pfad zu einem
bereits installierten Chromium- oder Chrome-Browser angeben.

Die Versionsnummer stammt für Frontend, Server und Android aus `package.json`.
Die Android-`versionCode` wird aus der dreiteiligen Version berechnet. Änderungen
an lokal mitgelieferten Grafiken, Sounds oder Clientcode erfordern ein neues
App-Build. Serverseitige Grafikset-Overrides werden von dieser Variante nicht
automatisch heruntergeladen.

## GitHub-Build

Der Workflow `android.yml` prüft den Client und erzeugt eine Debug-APK als
Workflow-Artefakt. Er veröffentlicht die App nicht in einem Store und führt
kein Serverdeployment aus. Die bestehende Produktionsprüfung bleibt getrennt.

## Geräteprüfung vor einer Veröffentlichung

Zusätzlich zum APK-Build und den lokalen Integrationstests auf einem echten
Android-Gerät eine komplette Partie, die Chat-Tastatur, alle vier Designs,
Hoch-/Querformat, Zurück-Geste sowie einen kurzen App- und WLAN/Mobilfunkwechsel
prüfen. Ein Chromium-Test ersetzt keine Prüfung der nativen Android-Oberfläche.
