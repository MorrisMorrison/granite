# 05 — Sync & offline

This is the architecturally hardest part, so it gets its own doc. The goal: **the app is fully usable
offline, and data converges correctly across devices and the server.**

## Principles

1. **The device's local SQLite is the source of truth while offline.** The UI only ever reads/writes
   local SQLite. It never blocks on the network.
2. **Sync is a separate, retryable background process.** It can fail, retry, and run later without the
   user noticing.
3. **Records are created with client UUIDs.** A set logged on a plane has a real, final id immediately.
4. **Deletes are tombstones.** Soft-delete (`deleted_at`) so deletions propagate like any other change.
5. **Last-write-wins per record, by `updated_at`.** Simple and good enough for this domain (one user
   editing their own data; genuine concurrent edits of the *same* record are rare).

## Why last-write-wins, not CRDTs

CRDTs/OT shine for real-time multi-user editing of a shared document. Granite is the opposite: a
single user, occasionally on two devices, rarely editing the *same* record at the *same* time. The
realistic conflict is "I edited a routine on my phone and tablet while both were offline." LWW with
per-record `updated_at` resolves that deterministically with a fraction of the complexity. We can
revisit field-level merge later if it ever bites. **Don't over-engineer the backbone.**

## Data requirements (recap from [03](03-data-model.md))

Every syncable row has: `id` (UUIDv7), `user_id`, `created_at`, `updated_at`, `deleted_at?`.

## The protocol

A simple **pull-then-push** cycle over two endpoints. Sync operates on a stream of `Change` objects:

```jsonc
// a Change
{
  "entity": "workout_set",      // which table
  "id": "0192f...-uuid",        // record id
  "updated_at": 1718900000000,
  "deleted": false,             // true → tombstone
  "data": { /* full row, omitted when deleted */ }
}
```

### Pull — `POST /api/v1/sync/pull`
```
request:  { "since_cursor": "<opaque>" }     // null on first sync → full snapshot
response: { "changes": [Change...], "next_cursor": "<opaque>" }
```
- The cursor encodes a **server-side change watermark** (e.g. a monotonic `server_seq` per user, or a
  high-water `updated_at` + tie-breaker). The client stores it and sends it back next time.
- The server returns every change for this user with `server_seq > cursor`.
- The client applies each change to local SQLite using LWW (`apply if incoming.updated_at >= local.updated_at`).

### Push — `POST /api/v1/sync/push`
```
request:  { "changes": [Change...] }                 // the client's local pending changes
response: { "applied": [ids], "conflicts": [Change...], "server_time": 1718900000000 }
```
- The server applies each incoming change with the same LWW rule and assigns it a new `server_seq`.
- If the server's version is newer, it **rejects** that change and returns the winning server version
  in `conflicts[]`; the client adopts it. (So push can teach the client too.)
- **Idempotent:** re-pushing the same change (id + updated_at) is a no-op. Safe to retry after a
  dropped connection.

### The cursor: server_seq

The cleanest watermark is a per-user monotonically increasing `server_seq` stamped on every server-side
write. Pull = "give me everything with `server_seq > my_cursor`." This avoids clock-skew problems that
a pure `updated_at` cursor would have. (`updated_at` is still used for LWW *conflict resolution*; the
*cursor* is `server_seq`.)

## Client sync loop

```
on (app start | network regained | local write debounced | periodic):
   pull(since_cursor) → apply changes → save next_cursor
   push(local pending changes) → mark applied; adopt any conflicts
   (run in a single transaction boundary per batch; all in local SQLite)
```

- **Pending queue:** a local `_pending` marker (or an outbox table) tracks rows changed since last
  successful push.
- **Ordering:** push parents before children where FKs matter, or relax FK enforcement during apply
  and validate after (simpler). Decide at implementation; lean on "apply all in one txn."

## Edge cases & how we handle them

| Case | Handling |
|---|---|
| First sync on a new device | `since_cursor = null` → server sends a full snapshot. |
| Logged a set offline for hours | It already has a UUID + `updated_at`; pushes whenever back online. |
| Same record edited on two offline devices | LWW by `updated_at`; later write wins; loser is overwritten (acceptable for this domain). |
| Delete vs. edit race | Tombstone has an `updated_at` too; LWW decides. A newer edit can "undelete" — acceptable; revisit if needed. |
| Clock skew across devices | Conflict resolution uses `updated_at` (best-effort); the **cursor** uses server_seq, so we never *miss* changes even if clocks lie. |
| Partial push (connection drop) | Idempotent; unconfirmed changes stay pending and re-push. |
| Server restore from backup | server_seq must be monotonic; persist it. Clients re-pull from their cursor. |

## What we are explicitly NOT doing (yet)

- Field-level merge / CRDTs.
- Real-time push (websockets). Polling + sync-on-events is enough for MVP; add push later.
- End-to-end encryption of synced data (the user owns the server, so it's their DB). Possible future.

## Testing strategy

Sync logic is the riskiest code, so it gets the most tests:
- Property/scenario tests for the LWW + tombstone rules.
- "Two clients + a server" simulation: random offline edits → assert convergence.
- Idempotency: replay a push batch, assert no duplication / no drift.
