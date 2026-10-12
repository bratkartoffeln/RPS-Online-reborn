# HTTPS über Standardports – RPS Arena v0.4.5

Diese alternative Anleitung verwendet die öffentlichen Ports **80 und 443**.
**Sie wird für deine eingerichtete Spieladresse auf Port 8443 nicht verwendet.**
Dein Update des bestehenden DNS-01-HTTPS steht in
[QNAP-UPDATE.md](QNAP-UPDATE.md); dessen Einrichtung und Diagnose sind in
[QNAP-HTTPS.md](QNAP-HTTPS.md) dokumentiert.

Diese Anleitung ergänzt die vorhandene Container-Station-Installation auf
dem QNAP TS-251D. Das Compose-Projekt heißt weiterhin **rps-arena**, der
Projektordner ist:

```text
/share/Container/rps-arena/rps-remake
```

Zieladresse nach erfolgreicher Einrichtung:
**https://flusensieb.dns.navy**. Der Caddy-Container beschafft und erneuert
das Zertifikat und leitet Webseite und WebSocket-Spielverbindungen an
`rps:2567` im gemeinsamen Docker-Netz weiter.

## 1. Bestehende Freigaben und DNS prüfen

In der FRITZ!Box unter **Internet → Freigaben → Portfreigaben** nachsehen,
ob externe TCP-Ports 80 oder 443 bereits verwendet werden. Vorhandene
Freigaben für andere Dienste zuerst zuordnen, bevor neue Einträge angelegt
werden. Das NAS anhand des bereits verwendeten Geräts **QNAS1** auswählen;
seine dort angezeigte LAN-IP ist auch das Ziel für die neuen Einträge.

Diese Konfiguration verwendet **IPv4-Portumleitung**. Der laufende
Spielserver antwortete beim Test am 11. Oktober 2026 auch über die im
A-Eintrag veröffentlichte IPv4 direkt auf Port 2567. Unter
**Internet → Online-Monitor** lässt sich die aktuelle öffentliche IPv4
des Anschlusses für den Abgleich mit dem DDNS-Eintrag nachsehen.

### Vorhandener IPv6-Eintrag der Domain

Beim Abruf am 11. Oktober 2026 hatte `flusensieb.dns.navy` sowohl einen
**A-Eintrag** (IPv4) als auch einen **AAAA-Eintrag** (IPv6). Vor der
Zertifikatsausstellung deshalb beim zuständigen DDNS-Anbieter prüfen:

- Der A-Eintrag muss auf die aktuelle öffentliche IPv4 des Anschlusses zeigen.
- Die hier vorgesehenen NAS-Ports **18080/18443** werden von der FRITZ!Box
  nur für IPv4 aus **80/443** umgesetzt. Eine zusätzliche IPv6-Freigabe der
  hohen NAS-Ports erzeugt keinen HTTPS-Zugang auf IPv6-Port 443.
- Für den Betrieb dieses Spielhostnamens ausschließlich über IPv4 darf er
  keinen AAAA-Eintrag veröffentlichen. Falls der Name auch für andere
  IPv6-Dienste verwendet wird, diese Nutzung erst klären; gegebenenfalls
  einen eigenen Spielhostnamen verwenden und `RPS_DOMAIN` entsprechend setzen.
- Soll auch IPv6 angeboten werden, muss der AAAA-Eintrag zum tatsächlichen
  Caddy-Endpunkt führen, an dem die Ports **80/443 direkt** erreichbar sind.
  Das benötigt eine andere Port-/Adresskonfiguration als diese Anleitung.

Ein unpassender AAAA-Eintrag kann die Zertifikatsprüfung verhindern, obwohl
IPv4 richtig eingerichtet ist. Let’s Encrypt versucht zunächst IPv6 und
wechselt nicht nach jeder Fehlerantwort zu IPv4. Es geht um den DNS-Eintrag
dieses Hostnamens; IPv6 im Heimnetz muss dafür nicht allgemein abgeschaltet
werden. Aktualisiert die FRITZ!Box den DDNS-Eintrag, auch deren
Update-Konfiguration beim DDNS-Anbieter berücksichtigen.

## 2. Vollständige Version auf dem NAS übernehmen

1. ZIP separat entpacken. Sie enthält den vollständigen Ordner `rps-remake`.
2. Den Inhalt des neuen `rps-remake` in den vorhandenen Projektordner
   übernehmen. Es darf kein zusätzlicher Ordner `rps-remake/rps-remake`
   entstehen. Die vorhandenen Ordner `skins/` und `secrets/` sowie die eigene
   `.env` beibehalten; diese lokalen Inhalte nicht durch Ordner aus der ZIP
   ersetzen.

Mit den mitgelieferten Standardwerten ist keine neue `.env` erforderlich.
Nur wenn Domain oder NAS-Ports geändert werden sollen, diese Werte in einer
vorhandenen `.env` ergänzen oder die passende Vorlage `.env.example` als
neue `.env` verwenden:

```dotenv
RPS_DOMAIN=flusensieb.dns.navy
RPS_PORT=2567
RPS_HTTP_PORT=18080
RPS_HTTPS_PORT=18443
ALLOWED_ORIGINS=
```

`RPS_DOMAIN` enthält nur den Hostnamen, ohne Protokoll, Port oder Pfad.
`ALLOWED_ORIGINS` leer lassen, wenn die bisherigen LAN-Adressen weiterhin
funktionieren sollen. Eine eingeschränkte Liste muss auch alle tatsächlich
verwendeten LAN-Ursprünge enthalten. Sie ersetzt keine Anmeldung.

## 3. Spiel und Caddy starten

Das Update zwischen zwei Partien durchführen: Der Neubau und Neustart des
Spielcontainers beendet laufende Partien. Wie bei deiner bisherigen
Installation zunächst über SSH die Administrations-Shell öffnen:

```sh
sudo -i
cd /share/Container/rps-arena/rps-remake
docker compose -p rps-arena -f compose.yaml --profile https config --quiet
docker compose -p rps-arena -f compose.yaml --profile https pull caddy
docker compose -p rps-arena -f compose.yaml --profile https up -d --build --force-recreate --wait --wait-timeout 120
docker compose -p rps-arena -f compose.yaml --profile https ps
```

Erwartet werden `rps-arena-rps-1` mit **healthy** und
`rps-arena-caddy-1` mit **Up**. Caddy startet erst, nachdem das Spiel bereit
ist. Der feste Projektname hält das bestehende Projekt und seine Volumes
zusammen. `--force-recreate` sorgt außerdem dafür, dass eine ausgetauschte
`Caddyfile` im Container neu eingebunden wird.

**Dieser Status bestätigt noch kein öffentliches HTTPS-Zertifikat.** Caddy
kann bereits laufen, während die Routerweiterleitung noch fehlt oder die
Zertifikatsausstellung erneut versucht wird. Diese Hinweise vor Abschluss
des nächsten Schritts sind erwartbar. Die Zeit für den Imagebau kommt zum
angegebenen Bereitschafts-Zeitlimit hinzu.

Bei einer Meldung über einen belegten NAS-Port 18080 oder 18443 einen freien
NAS-Port in `.env` setzen und denselben neuen Wert in der FRITZ!Box als
**Port an Gerät** verwenden. Die externen Ports bleiben 80/443.

## 4. Zwei IPv4-Freigaben in der FRITZ!Box anlegen

Unter **Internet → Freigaben → Portfreigaben** beim bestehenden NAS
**Bearbeiten** wählen. Falls es noch keinen Geräteeintrag gibt:
**Gerät für Freigaben hinzufügen → QNAS1**. Anschließend jeweils
**Neue Freigabe → Portfreigabe → Andere Anwendung** wählen.

| Feld | Erste Freigabe | Zweite Freigabe |
| --- | --- | --- |
| Bezeichnung | RPS HTTP | RPS HTTPS |
| Protokoll | TCP | TCP |
| Port an Gerät | **18080** | **18443** |
| bis Port | **18080** | **18443** |
| Port extern gewünscht (IPv4) | **80** | **443** |
| Freigabe aktivieren | Ja | Ja |
| Zugriffsart, sofern angezeigt | Internetzugriff über IPv4 | Internetzugriff über IPv4 |

Jede Freigabe mit **OK** bestätigen und auf der Geräteseite **Übernehmen**.
Danach die tatsächlich zugewiesenen externen Ports kontrollieren; sie müssen
80 und 443 sein. Keine zusätzliche UDP-Freigabe ist für diese Konfiguration
vorgesehen; HTTP/3 ist im Caddyfile ausgeschaltet.

Die Zuordnung ist somit **Internet 80 → NAS 18080 → Caddy 80** und
**Internet 443 → NAS 18443 → Caddy 443**. In das FRITZ!Box-Feld
„Port an Gerät“ gehören die hohen NAS-Ports aus der Tabelle.

Ist QuFirewall oder eine andere NAS-Firewall aktiv, muss sie die beiden
gewählten NAS-Ports für den eingehenden Spielzugang zulassen.

## 5. Zertifikat und öffentliche Spielverbindung prüfen

Die Caddy-Meldungen ansehen:

```sh
docker compose -p rps-arena -f compose.yaml --profile https logs --tail=100 caddy
```

Nach richtigen DNS-Einträgen und Freigaben kann Caddy das Zertifikat
automatisch ausstellen. Falls zuvor Versuche fehlgeschlagen sind, wartet
Caddy vor dem nächsten Versuch gegebenenfalls eine Weile; ständige Neustarts
sind dafür nicht erforderlich.

Auf einem Smartphone **WLAN ausschalten** und über Mobilfunk öffnen:

- **https://flusensieb.dns.navy**: Spiel erscheint ohne Zertifikatswarnung.
- **https://flusensieb.dns.navy/ready**: `ok: true` und `version: 0.4.5`.
- **http://flusensieb.dns.navy**: Weiterleitung auf HTTPS.

`https://NAS-IP:18443` ist kein geeigneter Zertifikatstest: Das öffentliche
Zertifikat gehört zum Domainnamen. Für externe Einladungen die Partie über
die öffentliche HTTPS-Adresse öffnen, damit der kopierte Link diese Adresse
enthält. Eine laufende Sitzung wird beim Wechsel von der LAN-Adresse zur
HTTPS-Adresse nicht automatisch übernommen; eine neue Partie über die
gewünschte Adresse beginnen.

Zusätzlich ist die automatische Funktionsprüfung jetzt im Spielcontainer
verfügbar:

```sh
docker compose -p rps-arena -f compose.yaml exec -T rps npm run check:online -- https://flusensieb.dns.navy
```

Sie erzeugt eine eigene kurze Testpartie, prüft zwei Spielverbindungen,
Geheimhaltung, einen Zug und Wiederbeitritt und schließt die Testpartie
anschließend. Bestehende fremde Partien werden dafür nicht verwendet.
Der Aufruf vom NAS verwendet dessen Netzwerkweg zur Domain. Scheitert nur
der Aufruf im Heimnetz, während Mobilfunk funktioniert, lokale
Namensauflösung und NAT-Rückweg gesondert prüfen; das ist kein Beleg für
einen allgemeinen Serverausfall.

Eine echte Partie mit einem Rechner und einem zweiten Gerät über Mobilfunk
ergänzt die Prüfung um Touch-Bedienung, Animationen, Duelle und Audio.

## 6. Nach erfolgreicher HTTPS-Partie aufräumen

Die bisherige öffentliche Routerfreigabe **TCP 2567** entfernen. Im
Compose bleibt der LAN-Port 2567 veröffentlicht und lokal nutzbar. Falls
auch eine gesonderte IPv6-Freigabe für 2567 angelegt wurde, diese ebenfalls
prüfen und für einen ausschließlich über HTTPS angebotenen Zugang entfernen.

Die Zertifikate liegen in den Docker-Volumes
`rps-arena_caddy_data` und `rps-arena_caddy_config`. Bei Updates erhalten;
beim normalen Container-Neuerstellen werden sie weiterverwendet. Für ein
normales Update ist kein `down` nötig; kein `down -v` ausführen.

## Spätere Updates

Neue Komplettversion übernehmen, eigene `skins/` und `.env` beibehalten und
dieselben Befehle aus Abschnitt 3 ausführen. Der Spielserver startet neu;
laufende Partien deshalb vorher beenden. Soll nur eine geänderte Caddyfile
neu eingebunden werden, genügt:

```sh
docker compose -p rps-arena -f compose.yaml --profile https up -d --no-deps --force-recreate caddy
```

## Zum reinen LAN-Betrieb zurückkehren

```sh
docker compose -p rps-arena -f compose.yaml --profile https stop caddy
```

Danach die beiden zugehörigen FRITZ!Box-Freigaben 80/443 deaktivieren. Das
Spiel ist weiter über seine LAN-Adresse mit Port 2567 verfügbar. Die
Zertifikats-Volumes können für einen späteren HTTPS-Neustart bestehen bleiben.

## Quellen

- FRITZ!Box 6660 Cable, statische Portfreigaben:
  https://fritz.com/apps/knowledge-base/FRITZ-Box-6660-Cable/893_Statische-Portfreigaben-in-FRITZ-Box-einrichten/
- Caddy, automatische Zertifikate und Standardports:
  https://caddyserver.com/docs/automatic-https
- Caddy, Reverse Proxy und WebSockets:
  https://caddyserver.com/docs/caddyfile/directives/reverse_proxy
- Offizielles Caddy-Containerimage, Volumes und Konfigurationsmounts:
  https://hub.docker.com/_/caddy
- Let’s Encrypt, IPv6-Prüfung und fehlerhafte AAAA-Einträge:
  https://letsencrypt.org/docs/ipv6-support/
