# QNAP: HTTPS auf Port 8443 mit dynv6-DNS – RPS Arena v0.4.12

**Dein DNS-01-HTTPS ist bereits eingerichtet.** Du hast den erfolgreichen
Stagingtest und anschließend die öffentliche Onlineprüfung für **Version 0.3.3**
bestätigt. Für das Spielupdate auf **0.4.12** verwende
[QNAP-UPDATE.md](QNAP-UPDATE.md). Der vorhandene Token und die Zertifikats-Volumes
bleiben erhalten; Token-Eingabe und Stagingtest müssen für dieses reine
Spielupdate nicht wiederholt werden.

Die folgenden Abschnitte dokumentieren die **Einrichtung und Diagnose** des
bestehenden DNS-01-Betriebs.

Diese Anleitung verwendet dein vorhandenes QNAP TS-251D mit Container Station,
Docker Compose 2.29.1 und dem Projekt **rps-arena**. Der Pfad bleibt:

```text
/share/Container/rps-arena/rps-remake
```

Die Spieladresse bleibt **https://flusensieb.dns.navy:8443**.

| Ebene | Zuordnung |
| --- | --- |
| Browser | HTTPS auf Port **8443** |
| FRITZ!Box 6660 Cable | IPv4: extern **TCP 8443 → QNAS1, Port 18443** |
| NAS / Docker | **18443 → Caddy 443** |
| Caddy → Spiel | **rps:2567** im bestehenden Compose-Netz |
| Zertifikatsprüfung | **DNS-01** über einen temporären TXT-Eintrag bei dynv6 |

Für diesen Modus sind keine öffentlichen Freigaben auf 80, 443 oder 8080
nötig. Caddy veröffentlicht mit dem DNS-Override auch keinen HTTP-Port 18080
auf dem NAS. Die Administrationsoberfläche der FRITZ!Box wird nicht umgestellt.

Version **0.3.2** ergänzte DNS-01 für die Zertifikatsprüfung, unabhängig von der
Erreichbarkeit öffentlicher Standardports. Der erfolgreiche DNS-Stagingtest und
die anschließende HTTPS-/WSS-Funktionsprüfung mit zwei Spielern auf **0.3.3**
bestätigen die Einrichtung auf deinem NAS.

Die ursprüngliche Alternative für öffentliche Ports 80 und 443 steht in
[QNAP-HTTPS-STANDARD.md](QNAP-HTTPS-STANDARD.md).

## 1. Vollständige Version übernehmen

1. **RPS-Arena-v0.4.12-komplett.zip** separat entpacken. Sie enthält den vollständigen Ordner `rps-remake`.
2. Den neuen Inhalt in den bestehenden Projektordner übernehmen. Es darf kein
   zusätzlicher Unterordner `rps-remake/rps-remake` entstehen. Den vorhandenen
   Ordner `skins/`, die eigene `.env` und den Ordner `secrets/` dabei beibehalten;
   diese lokalen Inhalte nicht durch Ordner aus der ZIP ersetzen.

Die laufenden Container verwenden weiterhin ihre bisherigen Images. Der Neubau
und der getrennte DNS-Test in den folgenden Schritten benötigen noch keinen
Neustart der laufenden Spielinstallation.

Die mitgelieferten Standardwerte passen zu deiner Einrichtung. In `.env` ist
`RPS_DOMAIN` nur der Hostname, also **ohne** `https://`, Port und Pfad:

```dotenv
RPS_DOMAIN=flusensieb.dns.navy
RPS_PORT=2567
RPS_HTTPS_PORT=18443
ALLOWED_ORIGINS=
```

`ALLOWED_ORIGINS` leer lassen, wenn auch die bisherigen LAN-Adressen nutzbar
bleiben sollen. Bei einer bewusst eingeschränkten Liste muss die öffentliche
Adresse **https://flusensieb.dns.navy:8443** einschließlich Port enthalten sein;
weitere gewünschte LAN-Adressen ebenfalls aufnehmen.

## 2. Dynv6-HTTP-Token lokal erfassen

Bei deiner bereits abgeschlossenen Einrichtung liegt der Token unter
`secrets/dynv6_api_token`. Die folgenden Schritte sind nur zur erstmaligen
Einrichtung oder zum gezielten Ersetzen des Tokens erforderlich.

Im dynv6-Konto prüfen, dass `flusensieb.dns.navy` unter den eigenen Zonen
verwaltet werden kann. Anschließend die Schlüssel-Seite öffnen:

**https://dynv6.com/keys**

Benötigt wird ein **HTTP-Token**, der DNS-Einträge dieser Zone über die REST-API
lesen, anlegen und löschen darf. Ein bereits verwendeter HTTP-Token kann passen,
wenn er diese Berechtigung besitzt. Ein SSH- oder TSIG-Schlüssel ist nicht der
Token für dieses Caddy-Modul. Falls dynv6 eine Einschränkung auf einzelne Zonen
anbietet, nur die benötigte Spielzone auswählen.

Den Token ausschließlich auf dem NAS eingeben. In einer interaktiven SSH-Sitzung
mit den beim bisherigen Aufbau verwendeten Administrationsrechten:

```sh
sudo -i
cd /share/Container/rps-arena/rps-remake
sh scripts/setup-dynv6-token.sh
```

Wer bereits in der Administrations-Shell arbeitet, beginnt direkt mit `cd`.
Seit Version **0.3.3** nutzt das Skript bevorzugt die eingebaute verdeckte
Eingabe `read -s` der Shell. Die auf deinem NAS bestätigte Unterstützung reicht
dafür aus; der dort fehlende Befehl `stty` wird nicht benötigt. Bei anderen Shells
steht `stty`, sofern vorhanden, weiterhin als Alternative zur Verfügung.

Beim Eingeben oder Einfügen des Tokens erscheinen keine Zeichen. Mit Enter
abschließen. Das Script schreibt `secrets/dynv6_api_token` mit Rechten **600**
in einen Ordner mit Rechten **700**. Ein vorhandener Token wird erst nach einer
gültigen neuen Eingabe ersetzt.

Die Datei enthält nur den Token, ohne `Bearer`, Variablennamen oder zusätzliche
Anführungszeichen. Sie wird als schreibgeschütztes Compose-Secret ausschließlich
in den Caddy-Container eingebunden. Die ZIP enthält keinen echten Token;
`.dockerignore` schließt den gesamten Secret-Ordner aus dem Spielimage aus.
Das Caddy-Image hat einen eigenen, kleinen Build-Kontext ohne diesen Ordner.

## 3. Caddy-Image bauen und DNS-Prüfung ausführen

Der Stagingtest ist für die erstmalige DNS-Einrichtung oder eine geänderte
DNS-/Token-Konfiguration gedacht. Für das unveränderte, bereits bestätigte
HTTPS beim Update auf 0.4.12 genügt [QNAP-UPDATE.md](QNAP-UPDATE.md).

**Für DNS-Betrieb immer beide Compose-Dateien in dieser Reihenfolge verwenden:**
`-f compose.yaml -f compose.dns.yaml --profile https`.

```sh
docker compose -p rps-arena -f compose.yaml -f compose.dns.yaml --profile https config --quiet
docker compose -p rps-arena -f compose.yaml -f compose.dns.yaml --profile https build caddy
docker compose -p rps-arena -f compose.yaml -f compose.dns.yaml --profile https run --rm --no-deps caddy caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
docker compose -p rps-arena -f compose.yaml -f compose.dns.yaml --profile https run --rm --no-deps caddy rps-check-dns
```

Das Caddy-Image wird lokal mit Caddy **2.11.7** und einer festgelegten Version
des dynv6-Moduls gebaut. Der erste Go-Build kann auf dem QNAP mehrere Minuten
dauern. Ein `pull caddy` ersetzt diesen Build nicht, weil dieses Image lokal
entsteht.

`rps-check-dns` startet einen eigenen kurzlebigen Container ohne veröffentlichte
Ports. Er verwendet ausschließlich die **Let's-Encrypt-Testumgebung (Staging)**,
einen eigenen temporären Zertifikatsspeicher und DNS-01. Ein temporärer
`_acme-challenge`-TXT-Eintrag wird durch Caddy angelegt und nach der Prüfung
wieder entfernt. Der Prüfprozess endet automatisch bei Erfolg oder nach seinem
Zeitlimit. Seine Containerdateien werden anschließend entfernt.

**Ein erfolgreicher Stagingtest bestätigt den tatsächlichen DNS-Zugriff und die
Zertifikatsprüfung.** Das Testzertifikat wird nicht für die Spielseite verwendet.
Die bestehenden produktiven Zertifikats-Volumes werden nicht als Testspeicher
genutzt. Caddy-Validierung allein würde die dynv6-Zugriffsrechte noch nicht prüfen.

Falls der Test fehlschlägt, die letzte Fehlermeldung prüfen und die laufende
Installation zunächst weiterverwenden. Bei `401`, `403` oder einer nicht gefundenen
Zone stimmen meist Token, Zonenberechtigung oder `RPS_DOMAIN` nicht. Bei einem
DNS-Propagationstimeout die Erreichbarkeit der DNS-Resolver und nach einer kurzen
Wartezeit einen erneuten Test prüfen. Den Token dabei nicht in Chat oder Logs kopieren.

## 4. Nach bestandenem DNS-Test Version 0.4.12 starten

Den Versionswechsel zwischen zwei Partien durchführen: Beim Neustart des
Spielservers enden Partien, Serienwertungen und Chatverläufe, da sie im Arbeitsspeicher liegen.

```sh
docker compose -p rps-arena -f compose.yaml -f compose.dns.yaml --profile https up -d --build --force-recreate --wait --wait-timeout 120
docker compose -p rps-arena -f compose.yaml -f compose.dns.yaml --profile https ps
docker compose -p rps-arena -f compose.yaml -f compose.dns.yaml --profile https logs --no-color --tail=80 caddy
```

Erwartet werden `rps-arena-rps-1` mit **healthy** und `rps-arena-caddy-1` mit
**Up**. `--wait` bestätigt den Containerstatus; der zuvor ausgeführte Stagingtest
prüft den DNS-Zertifikatsweg separat. Die Buildzeit kommt zum Bereitschaftslimit hinzu.

Der Caddy-Dienst behält seinen Namen und verwendet weiterhin die Volumes
`rps-arena_caddy_data` und `rps-arena_caddy_config`. Das bereits vorhandene gültige
Produktivzertifikat wird übernommen. Deshalb muss beim Neustart nicht erneut
`certificate obtained successfully` erscheinen. Künftige benötigte Prüfungen
laufen mit der neuen DNS-01-Konfiguration.

Die Volumes bei Updates erhalten. Für diese Umstellung ist kein `down`
erforderlich; kein `down -v` ausführen.

## 5. Spielzugang kontrollieren

Aufrufen:

- **https://flusensieb.dns.navy:8443** – Spielseite ohne Zertifikatswarnung.
- **https://flusensieb.dns.navy:8443/ready** – `ok: true`, Version **0.4.12**.

Danach die bereits bekannte Funktionsprüfung:

```sh
docker compose -p rps-arena -f compose.yaml -f compose.dns.yaml --profile https exec -T rps npm run check:online -- https://flusensieb.dns.navy:8443
```

Sie prüft Version, Browserdateien und Grafik-Map sowie zwei eigene
Spielverbindungen, Geheimhaltung, einen Zug, Serienwertung, gemeinsame
Fortsetzung und Wiederbeitritt. Anschließend schließt sie ihre Testpartie.
Eine Partie mit einem Gerät über Mobilfunk ergänzt den Aufruf vom NAS um einen
unabhängigen externen Netzwerkweg.

Einladungslinks über die öffentliche Spieladresse erzeugen, damit sie ebenfalls
`:8443` enthalten. Für direkte LAN-Adressen bleibt der Spielport **2567** vorhanden.
Eine bisherige öffentliche Routerfreigabe für 2567 kann nach erfolgreicher
HTTPS-Partie entfernt werden; der LAN-Zugang im Compose bleibt erhalten.

## DNS und IPv6 richtig zuordnen

DNS-01 bestätigt die Kontrolle über den Domainnamen; die Browser müssen zusätzlich
den richtigen Spielserver erreichen. Daher muss der A-Eintrag weiterhin auf die
aktuelle öffentliche IPv4 des Anschlusses zeigen.

Ein vorhandener AAAA-Eintrag darf nur einen IPv6-Endpunkt veröffentlichen, an dem
für dieselbe URL auch **Port 8443** erreichbar ist. Die IPv4-Umleitung
**8443 → 18443** stellt nicht automatisch eine entsprechende IPv6-Umleitung her.
Bei einem ausschließlich über IPv4 betriebenen Spielhostnamen einen unpassenden
AAAA-Eintrag mit der übrigen Nutzung des Namens und dem DDNS-Updater abstimmen;
keine fremde IPv6-Nutzung ungeprüft entfernen.

Die Anzeige der FRITZ!Box-Seite beim Zugriff aus dem Heimnetz ist kein verlässlicher
Nachweis für den Internet-Zugang auf demselben Port. Wenn nur lokale Aufrufe
scheitern, auch AdGuard, lokale DNS-Antworten und den NAT-Rückweg prüfen. Der
DNS-Challengetest benutzt ausdrücklich öffentliche Resolver für seine DNS-Prüfung.

## Spätere Updates

Neue Komplettversion übernehmen; eigene `skins/`, `.env`, Secret-Datei und
Zertifikats-Volumes erhalten. Der vollständige Spielupdate-Ablauf steht in
[QNAP-UPDATE.md](QNAP-UPDATE.md) und verwendet **beide Compose-Dateien**.
Wird nur Caddys Konfiguration oder Token geändert, kann ausschließlich dieser
Dienst neu erstellt werden:

```sh
docker compose -p rps-arena -f compose.yaml -f compose.dns.yaml --profile https up -d --build --no-deps --force-recreate caddy
```

Bei einer DNS-Änderung vorher den Stagingtest aus Abschnitt 3 wiederholen.
Ohne `compose.dns.yaml` würde ein späteres `up` den ursprünglichen Standardmodus
mit dem offiziellen Caddy-Image herstellen; deshalb bei DNS-Betrieb den zweiten
Dateiparameter beibehalten.

Für reinen LAN-Betrieb Caddy stoppen:

```sh
docker compose -p rps-arena -f compose.yaml -f compose.dns.yaml --profile https stop caddy
```

Das Spiel bleibt lokal auf Port 2567 erreichbar. Die zugehörige externe
8443-Freigabe kann dann in der FRITZ!Box deaktiviert werden.

## Quellen

- Caddy: automatische HTTPS-Verwaltung und DNS-Challenge:
  https://caddyserver.com/docs/automatic-https
- Caddy: DNS-Provider, Resolver und Propagationstimeout:
  https://caddyserver.com/docs/caddyfile/directives/tls
- Dynv6-Caddy-Modul:
  https://github.com/caddy-dns/dynv6
- Dynv6: Schlüssel und REST-API:
  https://dynv6.com/keys
  https://dynv6.github.io/api-spec/
- Docker Compose: zusammengeführte Ports mit `!override` ab 2.24.4:
  https://docs.docker.com/reference/compose-file/merge/
- Offizielles Caddy-Containerimage und eigener Build:
  https://hub.docker.com/_/caddy
