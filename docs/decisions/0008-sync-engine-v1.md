# ADR-0008 — Sync engine v1: aggregate granularity, `updated_at` cursor

**Status:** Accepted · 2026-06-21 · refines [ADR-0003](0003-offline-first-sync.md)

## Context
ADR-0003 settled the *model* (offline-first, pull/push, last-write-wins, tombstones, UUID ids,
`server_seq` cursor). This ADR records the concrete choices made building the **server** engine
(`apps/api/internal/sync`, endpoints `POST /api/v1/sync/{pull,push}`), where two details turned out to
be worth simplifying for v1.

## Decision
**1. Aggregate granularity.** The syncable units are the four top-level records: `exercise`,
`routine_folder`, `routine`, `workout`. A routine/workout syncs **as a whole** — its child rows
(exercises, sets) travel inside the parent's `data` payload and are replaced atomically on apply.
Children are not independently versioned.

**2. `updated_at` cursor (not `server_seq`) for v1.** Pull is `WHERE updated_at >= since` per entity;
the returned cursor is the max `updated_at` seen. Pull is **inclusive** and apply is **idempotent**, so
a boundary record may be re-delivered (and harmlessly re-applied) rather than skipped. LWW compares
`updated_at`; ownership is enforced on every apply (a push can only touch the caller's own rows, and
can never modify another user's record or a built-in exercise).

**3. Apply order.** Pull returns — and push applies — in FK-dependency order
(exercise → folder → routine → workout) so a client can apply the stream top-to-bottom without FK
violations.

## Alternatives considered
- **Per-record child sync** (each set/exercise row versioned + tombstoned). More granular conflict
  resolution, but needs sync metadata + user-scoping joins on child tables, and real concurrent edits
  of the *same set* across devices are vanishingly rare. Deferred.
- **`server_seq` cursor now.** The monotonic counter avoids same-millisecond boundary re-delivery.
  At household scale (one user, a handful of devices, server-serialized writes) the inclusive +
  idempotent `updated_at` cursor is correct and simpler. Kept as hardening (see below).

## Consequences
- ✅ Reuses the existing relational schema and nested create/replace logic — no migration, no new
  columns; both the REST API and sync write through the same tables.
- ✅ Deterministic, idempotent, retry-safe; heavily tested (full nested round-trip, incremental cursor,
  LWW both directions, tombstones, idempotency, cross-user isolation, ownership/hijack).
- ➖ Editing two *different* exercises of the same routine on two offline devices → last writer's whole
  routine wins (the other device's edit to the other exercise is lost). Acceptable for the domain;
  per-record child sync is the escape hatch if it ever bites.
- ➖ Same-millisecond boundary records can be re-delivered on the next pull (idempotent, so a no-op).
- 🔜 **Future hardening (when multi-device pressure warrants):** switch the cursor to a per-user
  `server_seq`; consider per-child-record versioning. Tracked in the roadmap.
