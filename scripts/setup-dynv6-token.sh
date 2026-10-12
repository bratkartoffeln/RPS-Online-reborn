#!/bin/sh
# Auf dem NAS interaktiv ausführen: sh scripts/setup-dynv6-token.sh
# Der Token wird weder als Befehlsargument übergeben noch ausgegeben.
# QNAP: read -s verwenden; stty ist nur ein Fallback für andere Shells.
set -eu

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
project_dir=$(CDPATH= cd -- "$script_dir/.." && pwd)
secret_dir="$project_dir/secrets"
secret_path="$secret_dir/dynv6_api_token"
temp_file=''
terminal_state=''

cleanup() {
    if [ -n "$terminal_state" ]; then
        stty "$terminal_state" < /dev/tty 2>/dev/null || :
    fi
    if [ -n "$temp_file" ]; then
        rm -f -- "$temp_file"
    fi
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
trap 'exit 129' HUP

if ! ( [ -t 0 ] < /dev/tty ) 2>/dev/null; then
    printf '%s\n' 'Kein interaktives Terminal verfügbar. Bitte dieses Script in einer interaktiven SSH-Sitzung auf dem NAS ausführen.' >&2
    exit 1
fi

# Eine künstliche Leerzeile prüft die Optionen ohne echte Eingabe. /dev/null
# wäre ungeeignet: read meldet bei EOF auch mit unterstützten Optionen Fehler.
if ( printf '\n' | ( IFS= read -r -s -p '' rps_probe ) ) 2>/dev/null; then
    input_mode='read-s'
elif command -v stty >/dev/null 2>&1; then
    input_mode='stty'
    if ! terminal_state=$(stty -g < /dev/tty 2>/dev/null); then
        printf '%s\n' 'Die Terminaleinstellungen konnten mit stty nicht gelesen werden.' >&2
        exit 1
    fi
else
    printf '%s\n' 'Verdeckte Eingabe nicht verfügbar: Diese Shell unterstützt read -s -p nicht, und der Befehl stty fehlt.' >&2
    exit 1
fi

token_prompt='Dynv6: HTTP-Token mit Zugriff auf die DNS-Einträge der Spiel-Domain eingeben.
Die Eingabe bleibt unsichtbar: '
token=''
input_ok=false
if [ "$input_mode" = 'read-s' ]; then
    # Die Shell übernimmt Echo-Unterdrückung, Prompt und Wiederherstellung.
    # Auch bei umgeleitetem stdout/stderr bleibt die Eingabe am Terminal.
    if IFS= read -r -s -p "$token_prompt" token < /dev/tty 2> /dev/tty; then
        input_ok=true
    fi
else
    stty -echo < /dev/tty
    printf '%s' "$token_prompt" > /dev/tty
    if IFS= read -r token < /dev/tty; then
        input_ok=true
    fi
    stty "$terminal_state" < /dev/tty
    terminal_state=''
fi
printf '\n' > /dev/tty
if [ "$input_ok" != true ]; then
    printf '%s\n' 'Eingabe abgebrochen; ein vorhandener Token wurde nicht geändert.' > /dev/tty
    exit 1
fi

case "$token" in
    ''|*[![:graph:]]*)
        printf '%s\n' 'Kein gültiger Token eingegeben: eine einzelne Zeile ohne Leerzeichen verwenden.' >&2
        exit 1
        ;;
esac

umask 077
mkdir -p -- "$secret_dir"
chmod 700 "$secret_dir"
temp_file=$(mktemp "$secret_dir/.dynv6_api_token.XXXXXX")
printf '%s\n' "$token" > "$temp_file"
unset token
chmod 600 "$temp_file"
mv -f -- "$temp_file" "$secret_path"
temp_file=''
printf '%s\n' 'Token in secrets/dynv6_api_token gespeichert (Dateirechte 600).'
printf '%s\n' 'Als Nächstes das Caddy-Image bauen und den DNS-Stagingtest aus QNAP-HTTPS.md ausführen.'
