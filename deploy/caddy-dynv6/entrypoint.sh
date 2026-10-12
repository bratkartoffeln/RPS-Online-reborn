#!/bin/sh
set -eu

rps_token_file=/run/secrets/dynv6_api_token
if [ ! -f "$rps_token_file" ] || [ ! -r "$rps_token_file" ]; then
    printf '%s\n' 'RPS: Das Secret /run/secrets/dynv6_api_token fehlt oder ist nicht lesbar.' >&2
    exit 1
fi

# Windows-Zeilenenden erlauben. Die Shell entfernt abschließende Zeilenumbrüche;
# weitere Zeilen oder Leerzeichen werden unten abgelehnt, nicht zusammengefügt.
if ! DYNV6_API_TOKEN=$(tr -d '\r' < "$rps_token_file"); then
    printf '%s\n' 'RPS: Die dynv6-Token-Datei konnte nicht gelesen werden.' >&2
    exit 1
fi
case "$DYNV6_API_TOKEN" in
    ''|*[[:space:]]*)
        printf '%s\n' 'RPS: Die dynv6-Token-Datei muss genau einen nicht leeren Token ohne Leerzeichen enthalten.' >&2
        exit 1
        ;;
esac

# Weder Token noch eine daraus zusammengesetzte Konfiguration ausgeben.
export DYNV6_API_TOKEN
exec "$@"
