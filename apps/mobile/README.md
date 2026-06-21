# apps/mobile — Granite client (SvelteKit)

The client: a **SvelteKit** app built static (`adapter-static`, SPA via `ssr = false` + an
`index.html` fallback), so the same build runs as an installable **PWA**, as the web app embedded in
the Go binary, and (later) inside a Capacitor webview. It's **offline-first**: all reads/writes hit a
device-local store and a sync client reconciles with the server.

## Stack

- **Svelte 5 + SvelteKit** (`adapter-static`), built with **Vite**.
- **IndexedDB** for the on-device store (via `idb`) — see
  [ADR-0010](../../docs/decisions/0010-web-local-store-indexeddb.md). It implements the `SyncStore`
  contract from `@granite/shared`, which the store-agnostic sync engine drives. (Native SQLite via
  Capacitor is a later, separate `SyncStore` implementation.)
- **`@granite/shared`** provides the generated API client and the sync engine.

## Structure

```
src/
  routes/
    login/ register/        # auth
    +page                   # Today
    history/                # past workouts
    exercises/              # searchable library + custom exercises
    routines/               # list with folders; new/ and [id] editor
    log/                    # the full-screen in-gym workout logger
    settings/               # account, JSON export, personal API tokens
  lib/
    components/ui/          # the component library (see below)
    api/                    # API client wiring + token storage
    local/                  # IndexedDB store (idb) + in-memory store
    repo/                   # exercises / routines / folders / workouts repositories
    sync/                   # syncNow() — one push+pull cycle
    stores/  config.ts
```

### UI component library (`src/lib/components/ui/`)

A small, shadcn-flavored set, dark theme with a deep-blue accent (`#2563eb`). Tokens live in
`src/app.css`; the design system is documented in
[docs/09 — UI design system](../../docs/09-ui-design-system.md). Components:
`Button`, `ListRow`, `Badge`, `PageHeader`, `EmptyState`, `Sheet` (bottom sheet, e.g. the exercise
picker), `BackLink`, `Icon` (inline SVG set), and `TabBar` (bottom navigation).

## Commands

Run from the repo root via the Makefile (`make build-web`, `make test-web`, `make run-web`) or here:

```sh
pnpm dev        # dev server (vite)
pnpm build      # static build → build/
pnpm test       # vitest (run once)
pnpm test:unit  # vitest (watch)
pnpm check      # svelte-check
pnpm e2e        # Playwright end-to-end (see Testing)
```

## Testing

- **Unit — vitest.** `pnpm test` runs the component/store unit suites (e.g. the IndexedDB store and
  the API client).
- **End-to-end — Playwright, real binary.** `corepack pnpm --filter mobile e2e` (or `pnpm e2e`). The
  harness in `e2e/serve.mjs` builds the SPA, embeds it into the Go binary, and runs that binary
  against a throwaway SQLite DB — no mocks, no Docker; it's the same artifact that ships. Config in
  `playwright.config.ts`. Specs in `e2e/` cover:
  - `auth.spec.ts` — register, log out, log back in.
  - `routines.spec.ts` — create a routine + a folder and move the routine into it.
  - `workout.spec.ts` — log a workout and see it in history.
  - `tokens.spec.ts` — create and revoke a personal API token.

  Useful env knobs: `E2E_SKIP_BUILD=1` reuses the previous SPA+binary build for fast local re-runs;
  `E2E_PORT` changes the port; `GO_BIN` points at a specific `go`.

## Capacitor

Capacitor is **not wired up yet** (PWA-first). The native iOS/Android wrappers are a later packaging
step over the same static build — not a rewrite.
