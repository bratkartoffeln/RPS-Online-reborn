FROM caddy:2.11.7-builder-alpine AS builder

# Caddy und DNS-Modul bewusst auf geprüfte Versionen festlegen.
RUN xcaddy build v2.11.7 \
    --with github.com/caddy-dns/dynv6@v0.0.0-20251101220214-71fad600afb2

FROM caddy:2.11.7-alpine
COPY --from=builder /usr/bin/caddy /usr/bin/caddy
COPY entrypoint.sh /usr/local/bin/rps-caddy-entrypoint
COPY check-dns.sh /usr/local/bin/rps-check-dns
RUN chmod 755 /usr/local/bin/rps-caddy-entrypoint /usr/local/bin/rps-check-dns

ENTRYPOINT ["/usr/local/bin/rps-caddy-entrypoint"]
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
