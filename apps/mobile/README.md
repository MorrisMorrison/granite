# apps/mobile — Granite client (SvelteKit + Capacitor)

The client: a **SvelteKit** app built static (`adapter-static`, SPA via `ssr = false` + an
`index.html` fallback), so the same build runs inside a Capacitor webview, as an installable PWA, and
as the web app embedded in the Go binary. On-device data will live in **SQLite**; a sync client
reconciles with the server.

> Scaffold stage — a placeholder screen only. See [docs/06 — Mobile app](../../docs/06-mobile-app.md).

## Commands
Run from the repo root via the Makefile (`make build-web`, `make test-web`, `make run-web`) or here:

```sh
pnpm dev        # dev server
pnpm build      # static build → build/
pnpm test       # vitest (run once)
pnpm check      # svelte-check
```

**Capacitor is not wired up yet** (PWA-first; it's a later packaging step).
