# A static site served by Caddy. The same image runs unchanged on Railway,
# Render, Fly, Cloud Run or a laptop — the only input is $PORT.
FROM caddy:2.11-alpine

COPY Caddyfile /etc/caddy/Caddyfile
COPY . /srv

# Fail the build rather than the deploy if the config is malformed.
RUN caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile

EXPOSE 8080
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
