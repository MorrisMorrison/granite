# 05 — Sync & offline

This is the architecturally hardest part, so it gets its own doc. The goal: **the app is fully usable
offline, and data converges correctly across devices and the server.**

## Principles

1. **The device's local store is the source of truth while offline.** The UI only ever reads/writes
   the local store. It never blocks on the network.
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

Every syncable row has: `id` (client-generated **UUIDv4**, via `crypto.randomUUID()`), `user_id`,
`created_at`, `updated_at`, `deleted_at?`, and a server-assigned `server_seq` (the pull cursor — see
below). We use plain v4 rather than a time-ordered variant: nothing in the protocol needs ids to sort
by creation time (the `server_seq` cursor handles ordering), so a random id is the simplest choice.

## The protocol

A simple **push-then-pull** cycle over two endpoints. Sync operates on a stream of `Change` objects:

```jsonc
// a Change
{
  "entity": "workout",          // exercise | routine_folder | routine | workout | bodyweight
  "id": "…-uuid",               // record id (UUIDv4)
  "updated_at": 1718900000000,  // epoch ms; the LWW key
  "deleted": false,             // true → tombstone
  "data": { /* the full aggregate, omitted/ignored when deleted */ }
}
```

Entities sync at **aggregate granularity**: a routine or workout travels together with its children
(its exercises and their sets) inside one `Change.data`. There are no per-child `Change` records — the
parent is the sync unit. On apply the server replaces the children wholesale (delete-then-recreate)
from the incoming aggregate.

### Push — `POST /api/v1/sync/push`
```
request:  { "changes": [Change...] }        // the client's local pending changes (the outbox)
response: { "applied": [ids], "cursor": 1234 }
```
- The server applies each incoming change with the LWW rule (`apply if incoming.updated_at >=
  stored.updated_at`, scoped to the owning user), in foreign-key-dependency order
  (exercise → routine_folder → routine → workout → bodyweight).
- `applied[]` lists the ids the server accepted. Ids not listed **lost** a last-write-wins race
  (the server already had a newer version) — there is **no `conflicts[]`**; the client simply learns
  the winning version from the following pull.
- `cursor` is the user's current `server_seq` after the push (the point to resume the pull from).
- **Idempotent:** re-pushing the same change is safe. Applying an older-or-equal `updated_at` is a
  no-op, so retrying a batch after a dropped connection never duplicates or corrupts data.

> The client clamps nothing, but the **server clamps** a client-supplied `updated_at` to `now + 5min`
> before comparing/storing it, so a device with a fast clock can't make its records win LWW forever.

### Pull — `POST /api/v1/sync/pull`
```
request:  { "since": 0 }                     // cursor from a previous pull/push; 0 for a full sync
response: { "changes": [Change...], "cursor": 1234 }
```
- The server returns every change for this user with **`server_seq > since`** (strict), in
  FK-dependency order, plus the new `cursor` (the max `server_seq` seen, or `since` if nothing changed).
- `since = 0` yields a full snapshot (everything the user has).
- The client applies each change to the local store using the same LWW rule, then persists `cursor`.

### The cursor: `server_seq`

The cursor is a **per-user monotonically increasing `server_seq`**, assigned by **SQLite `AFTER
INSERT/UPDATE` triggers** on every syncable table (see migration `00009_server_seq.sql`). Because it
lives in a trigger, *every* write path — sync push, REST CRUD, import, MCP — gets a seq; none can
forget to bump it. A per-user counter (`sync_state.last_seq`) hands out the values.

Pull is therefore "give me everything with `server_seq > my_cursor`." This is **clock-independent**:
unlike an `updated_at` cursor, it can't skip a change whose timestamp is older than the cursor. That
matters for imports — an imported record keeps its original (old) `updated_at` but gets a *fresh,
higher* `server_seq`, so an incremental pull still delivers it. (`updated_at` is used only for LWW
*conflict resolution*; the *cursor* is `server_seq`.)

## Client sync loop

The client runs one cycle — **push, then pull** — per `syncNow()`:

```
syncNow():
   pending = store.getPending()          # the local outbox
   if pending: push(pending); markPushed(pending)
   since = store.getCursor()
   { changes, cursor } = pull(since)
   store.applyRemote(changes)            # LWW against local state
   store.setCursor(cursor)
```

- **Push-first** so local edits reach the server before the pull; the pull then brings other devices'
  changes and re-confirms ours. A partially-completed cycle (push succeeded, pull failed) loses
  nothing — both directions are idempotent and LWW, so the next cycle recovers.
- **Pending queue (outbox):** a local outbox tracks rows changed since the last successful push.
  `markPushed` only clears outbox entries still at the pushed `updated_at`, so an edit made *during* a
  push survives and re-pushes next cycle.
- **Concurrent calls are deduped:** `syncNow()` returns the in-flight promise if a cycle is already
  running, so overlapping triggers coalesce into one cycle.

### When sync runs

Sync is triggered from exactly two places — there is **no periodic timer and no
network-regained listener**:

1. **On screen mount.** Data screens call `syncNow()` in `onMount` so opening a view pulls fresh data.
2. **Fire-and-forget after a local write.** Repository write methods kick off `void syncNow().catch(…)`
   after committing locally, so an edit pushes promptly when online — and, when offline, simply stays
   queued in the outbox for the next cycle. The write never blocks or fails on the sync.

Callers that are offline catch the rejection and carry on against local data. There is deliberately no
background scheduler: the app syncs when you look at data and when you change it, which is enough for a
single user's occasional multi-device use.

### Server-reset reconciliation

Before a cycle, the client fetches `GET /api/v1/server-info` and compares the server's `instance_id`
to the last one it saw. If the server's DB was recreated (new `instance_id`), the cursor and cached
data are stale, so the client wipes its local cache and re-pulls from `since = 0`. If unsynced local
changes are still queued, it attempts one push at the new server first and warns if anything remains,
rather than dropping it silently. (`resync()` forces the same full re-pull by resetting the cursor to
0 — needed after a server-side import, whose backdated `updated_at`s an incremental pull would still
deliver via `server_seq`, but a cursor reset is the belt-and-suspenders path.)

## Edge cases & how we handle them

| Case | Handling |
|---|---|
| First sync on a new device | `since = 0` → server sends a full snapshot. |
| Logged a set offline for hours | It already has a UUID + `updated_at`; pushes whenever back online. |
| Same record edited on two offline devices | LWW by `updated_at`; later write wins; loser is overwritten (acceptable for this domain). |
| Lost a push race | The id is absent from `applied[]`; the client adopts the server's newer version on the next pull. No `conflicts[]` payload is needed. |
| Delete vs. edit race | Tombstone carries an `updated_at` too; LWW decides. A newer edit can "undelete" — acceptable; revisit if needed. |
| Clock skew across devices | Conflict resolution uses `updated_at` (server-clamped to `now + 5min`); the **cursor** uses `server_seq`, so we never *miss* changes even if clocks lie. |
| Partial push (connection drop) | Idempotent; unconfirmed outbox entries stay pending and re-push. |
| Server restored/recreated | `instance_id` changes → clients detect it via `server-info`, wipe, and re-pull from cursor 0. |

## What we are explicitly NOT doing (yet)

- Field-level merge / CRDTs.
- Per-child-record sync. Aggregate granularity is the v1 unit (see [ADR-0008](decisions/0008-sync-engine-v1.md));
  per-child sync remains a future option.
- Real-time push (websockets), a periodic sync timer, or an online-event listener. Mount + after-write
  triggers are enough for MVP; add more later if needed.
- End-to-end encryption of synced data (the user owns the server, so it's their DB). Possible future.

## Testing strategy

Sync logic is the riskiest code, so it gets the most tests:
- Scenario tests for the LWW + tombstone + clock-clamp rules (`apps/api/internal/sync`).
- Store/engine contract tests for the client cycle (`packages/shared/src/sync`).
- Idempotency: replay a push batch, assert no duplication / no drift.
- Integration tests over the real endpoints (`apps/api/internal/server/sync_*_test.go`).
