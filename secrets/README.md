# Lokaler dynv6-Token

Den HTTP-Token auf dem NAS mit folgendem Befehl erfassen:

```sh
sh scripts/setup-dynv6-token.sh
```

Das Script legt `secrets/dynv6_api_token` an. Die Eingabe ist unsichtbar und
wird weder in einem Befehlsargument noch in der Shell-Historie gespeichert.
Die Datei erhält Rechte `600`, dieser Ordner Rechte `700`.

Ab Version 0.3.3 verwendet das Script bevorzugt `read -s` direkt in der Shell.
Damit funktioniert die verdeckte Eingabe auf der bestätigten QNAP-Shell auch
bei fehlendem `stty`. Andere Shells können einen vorhandenen `stty`-Befehl nutzen.

Der Token muss die DNS-Einträge der Spiel-Domain über die dynv6-REST-API
verwalten können. Die Datei enthält ausschließlich den Token, ohne
Variablennamen, Anführungszeichen oder `Bearer` davor. Ein bestehender Token
wird erst nach einer gültigen neuen Eingabe ersetzt.

`compose.dns.yaml` bindet diese Datei schreibgeschützt als Docker-Compose-
Secret in den Caddy-Container ein. Der Spielcontainer bekommt sie nicht.
Die echte Token-Datei gehört weder in eine Projekt-ZIP noch in ein Git-Repository.
Beim NAS-Update die eigene Datei erhalten und eine Sicherung geschützt ablegen.

Die vollständige Einrichtung und der getrennte Zertifikatstest stehen in
[QNAP-HTTPS.md](../QNAP-HTTPS.md).
