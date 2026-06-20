# packages/shared — shared TypeScript

Code shared by the mobile and web client:

- **Generated API client** — produced from the server's OpenAPI spec (type-safe, no hand-written DTOs).
- **Shared domain types.**
- **Sync client logic** — pull/push, the pending outbox, last-write-wins + tombstones. Isolated here so
  it's unit-testable independent of the UI.

> Not scaffolded yet — see [docs/05 — Sync & offline](../../docs/05-sync-and-offline.md).
