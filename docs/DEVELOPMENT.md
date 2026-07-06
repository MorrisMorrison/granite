# Development

How to work on Granite locally. To just **run** a release, see
[Run it yourself](../README.md#run-it-yourself-self-hosting) instead.

## Repo layout (monorepo)

```
granite/
├─ apps/
│  ├─ api/      # Go backend — REST API, sync engine, SQLite; embeds the web build
│  ├─ mobile/   # SvelteKit app (static SPA / PWA); Capacitor wrappers planned for iOS/Android
│  ├─ mcp/      # Model Context Protocol server (read + opt-in write tools)
│  └─ docs/     # Astro Starlight documentation site (renders these docs + the OpenAPI reference)
├─ packages/
│  └─ shared/   # TS: generated API client (from OpenAPI), shared types, sync engine
├─ deploy/      # docker-compose.yml + .env.example (self-hosting)
└─ docs/        # design docs + ADRs — see docs/README.md
```

The whole backend is **one Go binary + a SQLite file**. One SvelteKit **static build** is the single
source of truth for the UI: the Go binary embeds it to serve the self-hosted web app, and Capacitor
will wrap the same build for the app stores.

## Prerequisites

- **Go** 1.25+ (or any Go with `GOTOOLCHAIN=auto`, which the Makefile sets so the right toolchain
  self-fetches).
- **Node** 24 + **corepack** (provides `pnpm`; no global pnpm needed).

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

The dev scripts set **`GRANITE_ENV=dev`**, which makes the server **auto-seed the demo account**
(`demo@granite.local` / `demodata`) with routines and a few weeks of history on startup — no need to run
`seed-demo` by hand. It's idempotent, and only happens in dev (`GRANITE_ENV` defaults to `prod`).

## Build & test (Makefile)

```sh
make build      # build api + web + shared
make test       # go test + vitest across the workspace
make verify     # fmt + lint + test (pre-push gate)
make gen-client # regenerate openapi.yaml + the typed TS client after API changes
```

`GOTOOLCHAIN=auto` is set by the Makefile so the Go toolchain self-fetches the version `go.mod`
targets. JS deps run through `corepack pnpm`.

> The OpenAPI spec (`apps/api/openapi.yaml`) is generated from the Go code and is the contract for the
> TypeScript client. After changing the API, run `make gen-client`; CI fails if it's out of date.

## Testing

- **Unit — vitest.** `pnpm -r test` runs the TS unit suites: the sync engine + store contract in
  `packages/shared`, the IndexedDB store, the UI component library, the units/stats helpers, and the
  MCP tools.
- **End-to-end — Playwright, against the real binary.** `corepack pnpm --filter mobile e2e` builds the
  SPA, embeds it into the Go binary, and runs that binary against a throwaway SQLite DB — the same
  artifact that ships, no mocks or Docker. Specs in [`apps/mobile/e2e/`](../apps/mobile/e2e/) cover
  register/login, logging a workout into history, routines + folders, and API tokens. See the harness
  in `apps/mobile/e2e/serve.mjs` and `apps/mobile/playwright.config.ts`. Env knobs: `E2E_SKIP_BUILD=1`
  (reuse the previous build), `E2E_PORT`, `GO_BIN`.
- **Go.** `cd apps/api && go test ./...` (or `make test-api`).

## API reference

Every running instance serves an interactive reference at **`/docs`** and the spec at
**`/openapi.yaml`** — handy while developing against the API, for scripts, and for the MCP server.
