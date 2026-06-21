# Granite

> Open-source, self-hostable, **offline-first** workout tracker. Own your training data.
> A clean gym logger you run yourself — **without** a social network.

**Status:** 🟢 In active development, **in the open**. The Go API (auth, exercises, routines,
workouts, sync, export, personal API tokens) is in, and the SvelteKit app is a working offline-first
PWA — Today, History, Exercises, Routines (with folders), the in-gym logger, and Settings all exist.
See [`docs/`](docs/) for the design.

---

## What it is

Granite lets you build routines, log workouts at the gym (even with no signal), and see your
progress — and lets you **run the whole thing on your own server** so your data is yours.
Mobile-first, with a web app, a public REST API, and an MCP server to follow.

It deliberately leaves out the social network (feeds, followers, likes). It's a tool for *you* and
your training, not a platform.

## Locked decisions

| Area | Choice | Rationale |
|---|---|---|
| **Backend / API** | **Go** | Single static binary → trivial, low-resource self-hosting. |
| **Mobile app** | **SvelteKit + Capacitor** | Reuse web/Svelte skills; one codebase → mobile **and** web. Native SQLite + notifications. |
| **Data model** | **Offline-first + sync** | App fully works offline; syncs to your server when online. The product's backbone. |
| **Storage** | **SQLite** (device **and** server) | Full local copy per device drives instant offline reads/stats; the server is a single SQLite file. Postgres optional later. |
| **License** | **AGPL-3.0** | Keeps the project genuinely open, even when run as a service. |
| **Auth** | **Email + password + JWT** | Simple, works offline-first & multi-user. OIDC/passkeys later. See ADR-0006. |

Full reasoning lives in the [Architecture Decision Records](docs/decisions/).

## Repo layout (monorepo)

```
granite/
├─ apps/
│  ├─ api/         # Go backend — REST API, sync engine, SQLite, embeds the web build (MCP later)
│  └─ mobile/      # SvelteKit app (static SPA / PWA); Capacitor wrappers planned for iOS/Android
├─ packages/
│  └─ shared/      # TS: generated API client (from OpenAPI), shared types, sync logic
├─ docs/           # all design & planning docs (you are here)
└─ deploy/         # docker-compose + self-hosting assets (later)
```

The whole backend is **one Go binary + a SQLite file**. One SvelteKit **static build** is the single
source of truth for the UI: Capacitor wraps it for the app stores, and the Go binary embeds it to serve
the self-hosted web app.

## Documentation

| Doc | What's in it |
|---|---|
| [00 — Vision](docs/00-vision.md) | What & why, principles, non-goals |
| [01 — MVP scope](docs/01-mvp-scope.md) | What's in / out of the first release |
| [02 — Architecture](docs/02-architecture.md) | Components, stack, data flow, the OpenAPI contract |
| [03 — Data model](docs/03-data-model.md) | Entities, ER diagram, schema |
| [04 — API design](docs/04-api-design.md) | REST conventions, endpoints, errors, auth, MCP |
| [05 — Sync & offline](docs/05-sync-and-offline.md) | The offline-first sync engine (the hard part) |
| [06 — Mobile app](docs/06-mobile-app.md) | SvelteKit + Capacitor structure, screens, local DB |
| [07 — Self-hosting](docs/07-self-hosting.md) | Deployment model, config, backups |
| [08 — Roadmap](docs/08-roadmap.md) | Phases & milestones |
| [09 — UI design system](docs/09-ui-design-system.md) | Visual language, tokens, component library |
| [Decisions (ADRs)](docs/decisions/) | The reasoning behind each locked choice |

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
  copying it, or use **Settings → Export** for a JSON dump. Schema migrations run automatically on start.
- **Update:** `docker compose pull && docker compose up -d`.
- **HTTPS:** terminate TLS at a reverse proxy (Caddy / Traefik / nginx) and point `GRANITE_BASE_URL` at it.

Prefer the bare binary? `make build` produces `granite` with the web app embedded — run it with
`GRANITE_JWT_SECRET` set. Full reference: [docs/07 — Self-hosting](docs/07-self-hosting.md) and
[`deploy/`](deploy/).

## Local development

No `make` needed. From the repo root, in two terminals:

```sh
# 1) API — open registration + CORS for the dev origin, dev DB at apps/api/dev.db (needs Go on PATH)
pwsh scripts/dev-api.ps1     # Windows PowerShell
./scripts/dev-api.sh         # macOS / Linux

# 2) Web — SvelteKit dev server with hot reload
pnpm dev:web
```

Then open <http://localhost:5173> and register an account. The dev API uses a throwaway secret and
open registration — **local use only**.

### Build & test (Makefile)

```sh
make build      # build api + web + shared
make test       # go test + vitest across the workspace
make verify     # fmt + lint + test (pre-push gate)
make gen-client # regenerate openapi.yaml + the typed TS client after API changes
```

`GOTOOLCHAIN=auto` is set by the Makefile so the Go toolchain self-fetches the version `go.mod`
targets. JS deps run through `corepack pnpm` (no global pnpm needed).

## Testing

- **Unit — vitest.** `pnpm -r test` (or `make test-web`) runs the TS unit suites: the sync engine and
  store contract in `packages/shared`, the IndexedDB store, and the API client.
- **End-to-end — Playwright, against the real binary.** `corepack pnpm --filter mobile e2e` builds the
  SPA, embeds it into the Go binary, and runs that binary against a throwaway SQLite DB — the same
  artifact that ships, no mocks or Docker. Specs in [`apps/mobile/e2e/`](apps/mobile/e2e/) cover
  register/login, creating a routine + folder and moving it, logging a workout into history, and
  creating/revoking a personal API token. See the harness in `apps/mobile/e2e/serve.mjs` and
  `apps/mobile/playwright.config.ts`.

## Contributing

Granite is built in the open. It's early — issues and discussion are welcome. A formal contribution
guide will land as the project matures.

## License

[AGPL-3.0](LICENSE).
