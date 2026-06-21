# packages/shared — shared TypeScript

Code shared by the client (`@granite/shared`):

- **Generated API client** (`src/api/`) — `schema.d.ts` is generated from the server's OpenAPI spec
  (`make gen-client`); `client.ts` is the typed fetch wrapper. No hand-written DTOs; CI fails on drift.
- **Sync engine** (`src/sync/`) — `engine.ts` runs the pull-then-push cycle (last-write-wins by
  `updated_at` + tombstones) against a **store-agnostic `SyncStore` interface** (`types.ts`). The
  client picks the store: `memory-store.ts` here (and for tests), IndexedDB in the app
  (see [ADR-0010](../../docs/decisions/0010-web-local-store-indexeddb.md)). `api.ts` adapts the
  generated client to the sync endpoints.

Keeping the sync logic here, behind the `SyncStore` seam, makes it unit-testable independent of the UI
and of any particular on-device store.

## Testing

```sh
pnpm test     # vitest — engine convergence + the SyncStore contract (memory store)
```

See [docs/05 — Sync & offline](../../docs/05-sync-and-offline.md) for the protocol.
