# deploy — self-hosting assets

Granite is one Go binary that serves the API **and** the web app from a SQLite file — so a deploy is a
single container behind a reverse proxy. Files here:

- [`docker-compose.yml`](docker-compose.yml) — the container + a named volume for the database.
- [`.env.example`](.env.example) — copy to `.env` and fill in.

## Quick start

```sh
cd deploy
cp .env.example .env
# set GRANITE_JWT_SECRET (openssl rand -base64 48) and GRANITE_BASE_URL in .env
docker compose up -d
```

Open your `GRANITE_BASE_URL` and register — the **first account is always allowed**, even with
registration closed. Leave `GRANITE_ALLOW_REGISTRATION=false` to keep further signups off.

## Operating it

- **Data** lives in the `granite-data` volume at `/data/granite.db`. Back it up by copying that single
  file (stop the container, or take a hot copy with `sqlite3 .backup`), or use the in-app **JSON export**
  (Settings → Export, or `GET /api/v1/export`).
- **Bind mounts** are fine too: swap the named volume for a host dir (`-v /opt/granite/data:/data`) and
  the image fixes the directory's ownership on startup, so a plain `mkdir` works — no manual `chown`.
- **Update:** `docker compose pull && docker compose up -d`. Schema migrations run automatically on start.
- **Health:** the image ships a `HEALTHCHECK` hitting `/healthz`; `docker compose ps` shows status.
- **TLS:** terminate HTTPS at a reverse proxy (Caddy / Traefik / nginx) in front of the container and
  point `GRANITE_BASE_URL` at the public URL.

See [docs/07 — Self-hosting](../docs/07-self-hosting.md) for the full picture and the config reference.
