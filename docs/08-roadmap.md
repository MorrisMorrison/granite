# 08 — Roadmap

Phased so each step is usable on its own. Offline-first is built in from the start (retrofitting it
later is painful), but **sync** is deferred until after a single-device app works.

> **Status (2026-06-25):** Phases 0–5 are done, and a good chunk of Phase 6 has shipped too —
> bodyweight tracking, import from other trackers, and advanced analytics (the Stats hub) are all live,
> alongside a stack of in-app enhancements: history calendar, Today + Stats screens, custom exercises, quick deload,
> session notes, per-exercise notes, duplicate routine, auto cache-reset on a server reset, and a
> full UI consistency pass (shared list rows, page headers, icon buttons). Remaining Phase 6: native
> Capacitor builds, Apple Health / Google Fit (+ Watch/Wear OS), and OIDC / passkeys; plus optional
> sync hardening. All under a unit + end-to-end test net in CI.

## Phase 0 — Planning ✅
- [x] Decisions locked (stack, sync model, license, name).
- [x] Design docs + ADRs.
- [x] Scaffold the monorepo skeleton (`apps/`, `packages/`, tooling, CI).

## Phase 1 — API + data foundation ✅
- [x] Go service scaffold (HTTP, config, logging, typed error taxonomy).
- [x] SQLite schema + migrations for the core entities (with sync metadata).
- [x] Auth: register/login/refresh, JWTs, argon2id.
- [x] CRUD endpoints + OpenAPI spec + generated TS client.
- [x] Built-in exercise seed data.
- [x] `export` / `import`.

## Phase 2 — Mobile MVP, single-device (offline-first) ✅ *(core)*
- [x] SvelteKit app scaffold (`adapter-static`); local data layer (IndexedDB, [ADR-0010](decisions/0010-web-local-store-indexeddb.md)).
- [x] Exercises (library + built-ins), Routines (+ folders).
- [x] **Workout logger** hot path: sets, rest timer.
  - [x] "previous" set values; rest-timer notification (vibrate + beep).
- [x] History.
  - [x] Per-exercise progress chart + PRs (and a workout detail view).
- [x] Settings (account, JSON export, API tokens).
  - [x] Units, default rest, and other preferences; exercise search; JSON import.
- [x] Runs as an installable **PWA** (service worker, offline shell).
- 🎯 *Milestone met: log a full real session offline, no account/server needed.*

## Phase 3 — Sync ✅
- [x] Server sync endpoints (`POST /api/v1/sync/{pull,push}`), LWW + tombstones — see [ADR-0008](decisions/0008-sync-engine-v1.md).
- [x] Convergence tests (server-side: nested round-trip, incremental cursor, LWW, idempotency, isolation).
- [x] Sync client (pull/push, pending outbox, LWW, tombstones) in `packages/shared`.
- [x] Device-local store + app swapped to local-first.
- [x] Self-hosted round-trip verified (offline cutover + the real-binary e2e suite).
- [x] *(Hardening)* per-user `server_seq` pull cursor — monotonic, clock-independent, assigned by DB
      triggers on every write so backdated/imported records aren't skipped (migration `00009`).
- [ ] *(Hardening, later)* consider per-child-record sync (currently aggregate granularity).
- 🎯 *Milestone met: usable as a daily workout logger.*

## Phase 4 — Self-hosting polish ✅
- [x] Multi-stage Docker image (Go binary + embedded web build + SQLite).
- [x] `docker-compose.yml`, `.env.example`, setup docs.
- [x] GitHub Actions: build/test (+ image build on every PR); publish on main.
- [x] Backup guidance (SQLite snapshot / export); graceful shutdown for safe restarts.

## Phase 5 — Web + API/MCP for others
- [x] **MCP server** (read tools + opt-in guarded writes) + personal API tokens (read/write scopes).
- [x] Web app responsive / desktop layouts (UI overhaul — centered dialogs, etc.).
  - [x] Keyboard-first navigation pass.
- [x] Publish the REST API reference — rendered from the OpenAPI spec on the docs site (`/api`).

## Phase 6 — Native & nice-to-haves
- [ ] Capacitor native wrappers → app-store/sideload builds (needs macOS for iOS).
- [x] Bodyweight tracking — standalone synced weigh-in log (weight only; trend chart + shown on each
      workout in history). Deliberately minimal — no other body measurements.
- [x] Import from other trackers — Hevy CSV import (name-aliased to built-ins, custom for the rest),
      via the existing `/api/v1/import`.
- [x] Plate / 1RM / warmup calculators in UI (`/tools`).
- [x] Advanced analytics — a Stats hub: top lifts with e1RM sparklines, weekly volume, sets per
      muscle (4/8/12-week range), and an all-time records board.
- [ ] Apple Health / Google Fit; (later) Watch / Wear OS.
- [ ] OIDC / passkeys.

## Cross-cutting
- [x] **UI modernization & polish** — dark, deep-blue, shadcn-inspired component library + design
  system ([docs/09](09-ui-design-system.md)); every screen rebuilt on it.
- [x] **Test safety net** — unit tests (vitest: sync engine, IndexedDB store, UI components) plus a
  Playwright **end-to-end** suite against the real binary, all green in CI.

---

**Sequencing logic:** prove the *single-device offline app* (the actual product) before the *sync*
(the hard distributed part), and both before *packaging for others*. Each phase leaves something
usable.
