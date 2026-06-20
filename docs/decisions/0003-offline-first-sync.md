# ADR-0003 — Offline-first with last-write-wins sync

**Status:** Accepted · 2026-06-20

## Context
Gyms have bad signal; logging a set must never depend on the network. We also want multi-device use
and a self-hosted server of record. We need a conflict model that's correct enough without being a
research project.

## Decision
**Offline-first**: device-local SQLite is the source of truth on-device; a background sync client
reconciles with the server via a **pull/push** protocol. Conflicts resolved by **last-write-wins per
record** using `updated_at`; deletes are **tombstones**; records use **client-generated UUIDv7**; the
pull cursor is a per-user monotonic **`server_seq`**. Full design in [05](../05-sync-and-offline.md).

## Alternatives considered
- **Online-first + cache.** Simpler, but risks dropped logs on bad gym wifi — unacceptable for the
  core use case.
- **Local-only, sync later.** Fastest to a usable app, but self-hosting/own-your-data is a headline
  goal; we keep sync in the plan and just *sequence* it after the single-device app (see roadmap).
- **CRDTs / field-level merge.** Built for real-time multi-user editing of shared docs. Granite is
  single-user, rarely concurrent on the same record — LWW is dramatically simpler and sufficient.

## Consequences
- ✅ UI never blocks on the network; instant reads/writes against local SQLite.
- ✅ Simple, deterministic convergence; idempotent, retry-safe sync.
- ✅ `server_seq` cursor avoids clock-skew gaps (skew only affects LWW tie-breaks, not completeness).
- ➖ LWW can silently lose one side of a true concurrent edit of the same record — acceptable for this
  domain; revisit field-level merge only if it bites.
- ➖ Sync is the riskiest code → gets the heaviest test coverage (convergence + idempotency sims).
