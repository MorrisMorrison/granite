# Granite

> Open-source, self-hostable, **offline-first** workout tracker. Own your training data.
> A clean gym logger you run yourself.

[![CI](https://github.com/MorrisMorrison/granite/actions/workflows/ci.yml/badge.svg)](https://github.com/MorrisMorrison/granite/actions/workflows/ci.yml)
[![Docs](https://img.shields.io/badge/docs-live-2563eb)](https://morrismorrison.github.io/granite/)
[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-2563eb.svg)](LICENSE)

**Status:** 🟢 In active development, **in the open**. A working offline-first PWA — Today, History,
Exercises (with progress charts + PRs), Routines (with folders), the in-gym logger, and Settings —
backed by a Go API with auth, sync, JSON export/import, and personal API tokens.

## What it is

Granite lets you build routines, log workouts at the gym (even with no signal), and track your
progress — and lets you **run the whole thing on your own server** so your data is yours. It's
mobile-first with a web app, a public REST API, and an MCP server.

- **Offline-first** — every core action works with no network; changes sync to your server when online.
- **Yours to host** — one Go binary + a SQLite file behind a reverse proxy. JSON export/import, no lock-in.
- **One codebase** — a SvelteKit static build serves as the web app (and, later, the Capacitor mobile app).
- **AGPL-3.0** — genuinely open, even when run as a service.

The reasoning behind each major choice lives in the [Architecture Decision Records](docs/decisions/).

## Run it yourself (self-hosting)

Granite is a single Go binary that serves the API **and** the web app from one SQLite file — so hosting
it is one container behind a reverse proxy.

```sh
cd deploy
cp .env.example .env
# edit .env: set GRANITE_JWT_SECRET (openssl rand -base64 48) and GRANITE_BASE_URL
docker compose up -d
```

Open `GRANITE_BASE_URL` and **register** — the first account is always allowed, even with registration
closed (leave `GRANITE_ALLOW_REGISTRATION=false` to keep further signups off). That's it.

- **Your data** is the single file in the `granite-data` volume (`/data/granite.db`). Back it up by
  copying it, or use **Settings → Export** (restore via `POST /api/v1/import`). Migrations run on start.
- **API reference:** every instance serves an interactive reference at **`/docs`** and the spec at
  **`/openapi.yaml`**.
- **Update:** `docker compose pull && docker compose up -d`.
- **HTTPS:** terminate TLS at a reverse proxy (Caddy / Traefik / nginx) and point `GRANITE_BASE_URL` at it.

Full reference: [docs/07 — Self-hosting](docs/07-self-hosting.md) and [`deploy/`](deploy/).

## Documentation

📖 **Documentation site: <https://morrismorrison.github.io/granite/>** (generated from `docs/`).

Or browse the source: design docs, architecture, and ADRs live in **[`docs/`](docs/README.md)**. 

## Development

Building Granite locally — repo layout, dev servers, build & test, the e2e harness — is documented in
**[docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)**.

## Contributing

Granite is built in the open and contributions are welcome — see **[CONTRIBUTING.md](CONTRIBUTING.md)**.
To report a security issue, see [SECURITY.md](.github/SECURITY.md).

## License

[AGPL-3.0](LICENSE).
