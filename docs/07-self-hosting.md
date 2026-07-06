# 07 — Self-hosting

Self-hosting is a first-class goal, not an afterthought. The bar: **`docker-compose up` and one config
file** (or just run the binary). Granite is a **single container** — one Go binary that serves the
REST/sync API **and** the embedded web app, and stores everything in a SQLite file on a mounted volume.
There's no separate database process to run, tune, or back up.

## Quickstart (Docker Compose)

A ready-to-use [`deploy/docker-compose.yml`](../deploy/docker-compose.yml) +
[`deploy/.env.example`](../deploy/.env.example) ship in the repo — see [`deploy/`](../deploy/).

```yaml
services:
  granite:
    image: ghcr.io/morrismorrison/granite:latest
    # build: ..   # ...or build from source instead of pulling the image
    ports:
      - "${GRANITE_PORT:-8080}:8080"
    environment:
      PORT: "8080"
      GRANITE_DB_PATH: /data/granite.db
      GRANITE_BASE_URL: ${GRANITE_BASE_URL:-http://localhost:8080}
      GRANITE_ALLOW_REGISTRATION: ${GRANITE_ALLOW_REGISTRATION:-false}
      GRANITE_LOG_LEVEL: ${GRANITE_LOG_LEVEL:-info}
      GRANITE_JWT_SECRET: ${GRANITE_JWT_SECRET:?set GRANITE_JWT_SECRET in your .env}
    volumes:
      - granite-data:/data
    restart: unless-stopped

volumes:
  granite-data:
```

### `.env`

Copy `.env.example` to `.env` next to the compose file and fill it in:

```sh
# REQUIRED — signing secret for auth tokens (min 32 bytes):
#   openssl rand -base64 48
GRANITE_JWT_SECRET=

# Public URL your instance is reached at (no trailing slash). Behind a proxy, your https:// domain.
GRANITE_BASE_URL=http://localhost:8080

# Leave false for a personal instance — the FIRST account can always be created.
GRANITE_ALLOW_REGISTRATION=false

# Host port to expose (maps to the container's PORT).
GRANITE_PORT=8080

# debug | info | warn | error
GRANITE_LOG_LEVEL=info
```

Then `docker compose up -d` and open `GRANITE_BASE_URL`. Put it behind a reverse proxy (Caddy / Traefik /
nginx) for TLS. The optional [MCP server](../apps/mcp/) runs as a separate stdio process alongside the
container, not part of it.

If you run behind a proxy that **replaces** `X-Forwarded-For` (not appends to it), set
`GRANITE_TRUSTED_PROXY=true` so the rate limiter keys on the real client IP; leave it `false` (the
default) if the port is exposed directly, otherwise a client could spoof the header to bypass the
per-IP brute-force limits.

## Configuration (env vars)

| Var | Purpose |
|---|---|
| `GRANITE_DB_PATH` | Path to the SQLite file (on a mounted volume). |
| `GRANITE_JWT_SECRET` | Signing secret for JWTs. |
| `GRANITE_BASE_URL` | Public URL (links, CORS, etc.). |
| `GRANITE_ALLOW_REGISTRATION` | `true`/`false` or invite-gated — lock down a personal instance. |
| `GRANITE_TRUSTED_PROXY` | `true` only behind a proxy that replaces `X-Forwarded-For` (default `false`). |
| `GRANITE_LOG_LEVEL` | `debug`/`info`/`warn`/`error` (default `info`). |
| `PORT` | Listen port (default 8080). |

`GRANITE_JWT_SECRET` is **required** and must be ≥ 32 bytes (the server refuses to start otherwise) —
generate one with `openssl rand -base64 48`. Registration defaults **closed**, but the **first account
can always be created**, so a personal instance needs no extra steps to bootstrap.

## Backups & data ownership

- **Backups** are trivial: it's a **single SQLite file**. Back it up with the container **stopped**, or
  take a hot copy with `sqlite3 granite.db .backup backup.db` — don't just `cp` a live database, since
  WAL mode keeps recent writes in a side file and a raw copy can be inconsistent. For continuous,
  always-safe replication use a tool like Litestream. No DB dump tooling required.
- **In-app export**: `GET /api/v1/export` (Settings → Export) returns a complete JSON of your data —
  true "own your data," independent of file-level backups.
- **Restore**: either replace the SQLite file from a backup, or `POST /api/v1/import` an export JSON
  (upsert by id, idempotent) into a fresh or existing account.

## Graceful lifecycle

The server installs HTTP timeouts (slow-client protection) and shuts down gracefully on `SIGINT`/`SIGTERM`:
it stops accepting connections, drains in-flight requests (up to 15s), then closes SQLite cleanly — so
`docker compose stop`/restarts and host reboots won't corrupt the database or drop a request mid-write.

## Security notes

- argon2id password hashing; rotating refresh tokens.
- An instance is single-person/household; registration gated by default on self-hosts.
- Put it behind a reverse proxy with TLS; optionally behind an external identity provider once OIDC lands.
- No telemetry, ever.

## Minimal footprint

A single Go binary + a SQLite file comfortably runs on a Raspberry Pi, a NAS, or a small VPS/LXC. The
heavy read/stat work happens on the **client** (each device has the full local SQLite), so the server
stays light even with the whole history synced.

## Image & build

- The Go binary **embeds the SvelteKit static build**, so the image is self-contained — no separate
  web container, no Node at runtime.
- A pure-Go SQLite driver keeps the binary **CGO-free** and easy to cross-compile to a small static image.
- Multi-stage Docker build: build web (pnpm) → build Go (with embedded assets) → tiny final image
  (distroless/alpine).
- Built and published by **GitHub Actions** (public repo → free CI). Images published to a registry
  (e.g. GHCR) so self-hosters can `docker pull`, or build from source.
