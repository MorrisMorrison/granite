# 08 — Roadmap

Phased so each step is usable on its own. Offline-first is built in from the start (retrofitting it
later is painful), but **sync** is deferred until after a single-device app works.

## Phase 0 — Planning ✅ (this repo)
- [x] Decisions locked (stack, sync model, license, name).
- [x] Design docs + ADRs.
- [ ] Scaffold the monorepo skeleton (empty `apps/`, `packages/`, tooling, CI).

## Phase 1 — API + data foundation
- [ ] Go service scaffold (HTTP, config, logging, typed error taxonomy).
- [ ] SQLite schema + migrations for the core entities (with sync metadata).
- [ ] Auth: register/login/refresh, JWTs, argon2id.
- [ ] CRUD endpoints + OpenAPI spec + generated TS client.
- [ ] Built-in exercise seed data.
- [ ] `export` / `import`.

## Phase 2 — Mobile MVP, single-device (offline-only)
- [ ] SvelteKit app scaffold (`adapter-static`), local SQLite data layer.
- [ ] Exercises (library + custom), Routines (+ folders).
- [ ] **Workout logger** hot path: sets, "previous", rest timer + notification.
- [ ] History + per-exercise progress chart + PRs.
- [ ] Settings (units, rest default, export).
- [ ] Runs as an installable **PWA** for real on-phone testing.
- 🎯 *Milestone: log a full real session offline, no account/server needed.*

## Phase 3 — Sync
- [ ] Sync client (pull/push, pending outbox, LWW, tombstones) in `packages/shared`.
- [ ] Server sync endpoints + `server_seq` watermark.
- [ ] Convergence tests (two-client simulation, idempotency).
- [ ] Connect app to a self-hosted server; verify round-trip across reinstall / second device.
- 🎯 *Milestone: MVP success criteria met — usable as a daily workout logger.*

## Phase 4 — Self-hosting polish
- [ ] Multi-stage Docker image (Go binary + embedded web build + SQLite).
- [ ] `docker-compose.yml`, `.env.example`, setup doc.
- [ ] GitHub Actions: build/test/publish image.
- [ ] Backup guidance (SQLite file snapshot / export; optional Litestream).

## Phase 5 — Web + API/MCP for others
- [ ] Web app UX pass (desktop layouts, keyboard).
- [ ] Harden + document the public REST API (OpenAPI published).
- [ ] **MCP server** (read tools + guarded writes), personal API tokens.

## Phase 6 — Native & nice-to-haves
- [ ] Capacitor native wrappers → app-store/sideload builds (needs macOS for iOS).
- [ ] Body measurements / bodyweight tracking.
- [ ] Import from other trackers (CSV).
- [ ] Plate / 1RM / warmup calculators in UI.
- [ ] Apple Health / Google Fit; (later) Watch / Wear OS.
- [ ] OIDC / passkeys.
- [ ] Advanced analytics (volume per muscle group, etc.).

---

**Sequencing logic:** prove the *single-device offline app* (the actual product) before the *sync*
(the hard distributed part), and both before *packaging for others*. Each phase leaves something
usable.
