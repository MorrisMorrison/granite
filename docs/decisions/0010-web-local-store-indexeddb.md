# ADR-0010 — Web local store: IndexedDB (not SQLite-in-browser)

**Status:** Accepted · 2026-06-21 · refines [ADR-0004](0004-sqlite-everywhere.md)

## Context
ADR-0004 chose "SQLite everywhere" (device + server). On the **web/PWA** — the near-term client we
actually test — putting SQLite in the browser means wa-sqlite / sqlite-wasm over OPFS: a Worker + VFS
setup, often COOP/COEP headers for SharedArrayBuffer, a larger bundle, and browser-support edge cases.
Meanwhile the sync engine ([ADR-0008](0008-sync-engine-v1.md)) is deliberately **store-agnostic** — it
talks to a `SyncStore` interface over opaque records keyed by `entity:id`, and needs no SQL.

## Decision
The **web local store is IndexedDB** (via `idb`), implementing the existing `SyncStore` contract plus the
app's read/write methods. Records, the outbox, and the sync cursor live in three IndexedDB object stores.
SQLite remains on the **server** and on **native** (Capacitor, Phase 6). Rich local querying isn't needed:
Granite's data is small and aggregate-shaped (a routine/workout is one record with its children).

## Alternatives considered
- **SQLite in the browser** (wa-sqlite / sqlite-wasm + OPFS). True ADR-0004 fidelity and SQL on-device,
  but materially more setup/risk for no functional gain at this data scale. Revisit only if we need
  on-device SQL (e.g. heavy local analytics).
- **localStorage** — synchronous and size-limited; unfit for workout history volume.

## Consequences
- ✅ Simple, robust across browsers, no special headers; the sync engine plugs in unchanged.
- ✅ One web store now; native SQLite is a separate `SyncStore` implementation later (same interface).
- ➖ Web and native use different on-device engines (IndexedDB vs SQLite) — acceptable, both sit behind
  the same `SyncStore`/repository seam.
- ➖ Deviates from a strict reading of ADR-0004 ("SQLite everywhere"); recorded here so it's deliberate.
