# 04 — API design

The API serves three consumers with the same surface: the **Granite app** (mobile + web), **sync**,
and **third parties / MCP**. It is REST + JSON, described by an **OpenAPI 3.1** spec that generates the
TS client.

## Interactive reference

Every instance serves its own, always-up-to-date API reference (no hosting needed):

| Path | What |
|---|---|
| `/docs` | Interactive API reference (browse + try endpoints) |
| `/openapi.yaml`, `/openapi.json` | The machine-readable OpenAPI 3.1 spec |

These are generated from the Go code (code-first, via [huma](decisions/0007-huma-openapi.md)), so they
never drift from the implementation. The committed [`apps/api/openapi.yaml`](../apps/api/openapi.yaml)
is the same spec that drives the generated TypeScript client.

## Conventions

- Base path `**/api/v1**`. Version in the path; breaking changes bump the version.
- JSON everywhere; `snake_case` field names (matches the DB and keeps the OpenAPI→TS mapping boring).
- Timestamps: epoch milliseconds, UTC.
- IDs: client-generated **UUIDv4** (the server accepts the client's id on create — required for
  offline).
- Auth: `Authorization: Bearer <jwt>` on everything except auth + health. A personal API token
  (`Bearer <token>`) is accepted on the same endpoints for programmatic/MCP access — see
  [ADR-0009](decisions/0009-personal-api-tokens.md).
- **No pagination.** List endpoints return the whole collection (`{ "<entity>": [...] }`). The data is
  small — a single user's workout history — and every client keeps a full local copy anyway, so there
  is no cursor/limit convention. Filtering/aggregation happens client-side.

## Errors

Errors are **RFC 7807 problem+json**, emitted by huma from the server's `apperr` taxonomy — there is no
custom `{error, code, details}` envelope and no `conflicts[]`.

```json
{
  "type": "about:blank",
  "title": "Not Found",
  "status": 404,
  "detail": "routine not found",
  "instance": "…",
  "errors": [ /* optional per-field validation details */ ]
}
```
- Content type is `application/problem+json`. HTTP status reflects the class, mapped from the `apperr`
  constructor used server-side:
  `Validation` → 400, `Unauthorized` → 401, `Forbidden` → 403, `NotFound` → 404, `Conflict` → 409.
- Any unrecognized/internal error is logged server-side and returned as a generic **500** (cause never
  leaked).

## The surface

The whole API is ~33 JSON operations plus health/spec endpoints. This is the real, generated surface;
the [OpenAPI file](../apps/api/openapi.yaml) is the source of truth.

### Auth
```
POST   /api/v1/auth/register      {email, password}            → {user, access, refresh}
POST   /api/v1/auth/login         {email, password}            → {user, access, refresh}
POST   /api/v1/auth/refresh       {refresh}                     → {access, refresh}
POST   /api/v1/auth/logout        {refresh}
```

### Me
```
GET    /api/v1/me                                               → {user, settings}
PATCH  /api/v1/me                 {display_name?, settings?}     // partial: only provided fields change
```

### Sync (the primary data path — see [05](05-sync-and-offline.md))
```
POST   /api/v1/sync/push          {changes[]}                   → {applied[], cursor}
POST   /api/v1/sync/pull          {since}                       → {changes[], cursor}
```
`changes[]` is a batch of upserts/tombstones across all syncable entities, tagged by `entity` + `id`.
Note the order: clients **push then pull**. Neither response carries `conflicts[]` or a `server_time`;
a lost last-write-wins race just omits the id from `applied[]` and the client relearns the winner on
the next pull.

### Direct REST (same data, for non-sync clients / MCP / scripts)
```
GET/POST                 /api/v1/exercises
GET/PATCH/DELETE         /api/v1/exercises/{id}
GET/POST                 /api/v1/routine-folders
PATCH/DELETE             /api/v1/routine-folders/{id}
GET/POST                 /api/v1/routines
GET/PATCH/DELETE         /api/v1/routines/{id}
GET/POST                 /api/v1/workouts
GET/PATCH/DELETE         /api/v1/workouts/{id}
GET                      /api/v1/export                          → full JSON dump (no lock-in)
POST                     /api/v1/import                          → restore from dump
GET                      /api/v1/tokens                          → list personal API tokens
POST                     /api/v1/tokens                          → mint a token (shown once)
DELETE                   /api/v1/tokens/{id}                     → revoke a token
GET                      /api/v1/server-info                     → {instance_id, …} (sync reset detection)
```
- **`DELETE` is a soft delete** (sets `deleted_at`) so it propagates through sync.
- **`PATCH` on `/routines/{id}` and `/workouts/{id}` is a full-replace of the aggregate**, not a field
  patch: the request body is the *same* shape as create, and the server overwrites the routine/workout
  and recreates all its child exercises/sets from the payload. Resend the whole aggregate. (`PATCH
  /me` is the exception — it's a genuine partial update.)
- There is **no `GET /exercises/{id}/history` and no `GET /stats/prs`.** History and personal records
  (estimated 1RM via Epley, best set, volume) are **computed client-side** from the workout data each
  client already holds locally (`apps/mobile/src/lib/stats.ts`). The server stores; the client
  analyzes — consistent with [ADR-0004](decisions/0004-sqlite-everywhere.md).

### Ops
```
GET    /healthz       → liveness    |    GET /readyz → DB-ready
GET    /openapi.yaml, /openapi.json → the spec    |    GET /docs → interactive reference
```

## Auth model (MVP)

- Email + password, hashed with **argon2id**. JWT **access** token (short-lived) + **refresh** token
  (long-lived, rotating, revocable). See [ADR-0006](decisions/0006-auth-email-password-jwt.md).
- Designed multi-user from day one (each row scoped by `user_id`), but a single instance is typically
  one person or a household. Registration can be gated (env flag / an injected `AccountGate` — see
  [ADR-0011](decisions/0011-account-gate-extension-point.md)).
- **Personal API tokens** ([ADR-0009](decisions/0009-personal-api-tokens.md)) provide programmatic
  access with an optional write scope, used by scripts and the MCP server.
- Future: OIDC and passkeys.

## MCP server

Granite ships an **MCP server** (`apps/mcp`) exposing the user's own data to AI tooling. It talks to
the same REST API via a personal API token; it is not a separate data path. Tool names are
`snake_case`:

- **Read (always on):** `whoami`, `list_exercises`, `get_exercise`, `list_routines`, `get_routine`,
  `list_workouts`, `get_workout`.
- **Write (opt-in via `GRANITE_ALLOW_WRITE=true` *and* a write-scoped token):** `log_workout`,
  `create_routine`, `update_routine`, `create_folder`.

There is no `get-workouts`/`get-prs`/`get-exercise-history` tool — reads mirror the REST list/get
operations, and stats aren't a server concern. This is why the domain logic lives below the transport:
REST, sync, and MCP are faces of one core.

## Versioning & stability

- The OpenAPI spec is checked into the repo and is the contract. CI regenerates the TS client and
  fails on drift (`make gen-client`).
- Additive changes are fine within `v1`; breaking changes → `v2`.
