// Shared TypeScript for the Granite clients.
// The generated API client (from the server's OpenAPI spec), shared domain types,
// and the offline-first sync engine will live here — see docs/05-sync-and-offline.md.

// The generated, fully-typed API client (from the server's OpenAPI spec).
export * from './api/client';

// The offline-first sync client (engine + store contract + reference store).
export * from './sync';

/** Package marker. */
export const SHARED_PACKAGE = '@granite/shared';
