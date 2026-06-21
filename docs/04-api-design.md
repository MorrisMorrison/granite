# 04 — API design

The API serves three consumers with the same surface: the **Granite app** (mobile + web), **sync**,
and **third parties / MCP**. It is REST + JSON, described by an **OpenAPI 3** spec that generates the
TS client.

## Interactive reference

Every instance serves its own, always-up-to-date API reference (no hosting needed):

| Path | What |
|---|---|
| `/docs` | Interactive API reference (browse + try endpoints) |
| `/openapi.yaml`, `/openapi.json` | The machine-readable OpenAPI 3.1 spec |

These are generated from the Go code (code-first, via huma), so they never drift from the
implementation. The committed [`apps/api/openapi.yaml`](../apps/api/openapi.yaml) is the same spec that
drives the generated TypeScript client.

## Conventions

- Base path `**/api/v1**`. Version in the path; breaking changes bump the version.
- JSON everywhere; `snake_case` field names (matches the DB and keeps the OpenAPI→TS mapping boring).
- Timestamps: epoch milliseconds, UTC.
- IDs: client-generated UUIDv7 (the server accepts the client's id on create — required for offline).
- Auth: `Authorization: Bearer <jwt>` on everything except auth + health.
- Pagination: cursor-based (`?cursor=&limit=`), returning `{ data, next_cursor }`.

## Error envelope

```json
{ "error": "human-readable message", "code": "not_found", "details": { } }
```
- HTTP status reflects the class: 400 validation, 401 unauthenticated, 403 forbidden, 404 not found,
  409 conflict/already-exists, 422 semantic, 500 internal.
- `code` is a stable machine string clients branch on. **Messages are not contracts.**
- Internal failures return a generic 500 (cause logged server-side, never leaked).

## Endpoint sketch (MVP)

> This is a sketch to think with, not the final spec. The OpenAPI file is the source of truth.

### Auth
```
POST   /api/v1/auth/register      {email, password}            → {user, access, refresh}
POST   /api/v1/auth/login         {email, password}            → {user, access, refresh}
POST   /api/v1/auth/refresh       {refresh}                     → {access, refresh}
POST   /api/v1/auth/logout        {refresh}
GET    /api/v1/me                                               → {user, settings}
PATCH  /api/v1/me                 {display_name?, settings?}
```

### Sync (the primary data path — see [05](05-sync-and-offline.md))
```
POST   /api/v1/sync/pull          {since_cursor}                → {changes[], next_cursor}
POST   /api/v1/sync/push          {changes[]}                   → {applied[], conflicts[], server_time}
```
`changes[]` is a batch of upserts/tombstones across all syncable entities, tagged by `entity` + `id`.

### Direct REST (same data, for non-sync clients / MCP / scripts)
```
GET/POST/PATCH/DELETE  /api/v1/exercises[/:id]
GET/POST/PATCH/DELETE  /api/v1/routine-folders[/:id]
GET/POST/PATCH/DELETE  /api/v1/routines[/:id]
GET/POST/PATCH/DELETE  /api/v1/workouts[/:id]
GET                    /api/v1/exercises/:id/history
GET                    /api/v1/stats/prs
GET                    /api/v1/export                            → full JSON dump (no lock-in)
POST                   /api/v1/import                            → restore from dump
```
`DELETE` is a **soft delete** (sets `deleted_at`) so it propagates through sync.

### Ops
```
GET    /healthz       → liveness    |    GET /readyz → DB-ready
GET    /openapi.json  → the spec    |    GET /metrics (later)
```

## Auth model (MVP)

- Email + password, hashed with **argon2id**. JWT **access** token (short-lived, ~15 min) + **refresh**
  token (long-lived, rotating, revocable). See [ADR-0006](decisions/0006-auth-email-password-jwt.md).
- Designed multi-user from day one (each row scoped by `user_id`), but a single instance is typically
  one person or a household. Registration can be gated by an env flag / invite for self-hosts.
- Future: OIDC (so an instance can sit behind an external identity provider) and passkeys.

## MCP server (later phase)

Granite ships an **MCP server** exposing the user's own data to AI tooling, mirroring the common
operations of a workout tracker:

- Read: `get-workouts`, `get-workout`, `get-routines`, `get-exercise-history`, `get-prs`, `get-user-info`.
- Write (guarded): `create-routine`, `create-workout`, `update-routine`.
- Auth via a personal API token scoped to the user; same domain layer as REST.

This is why the domain logic lives below the transport: REST, sync, and MCP are three faces of one core.

## Versioning & stability

- The OpenAPI spec is checked into the repo and is the contract. CI regenerates the TS client and
  fails on drift.
- Additive changes are fine within `v1`; breaking changes → `v2`.
