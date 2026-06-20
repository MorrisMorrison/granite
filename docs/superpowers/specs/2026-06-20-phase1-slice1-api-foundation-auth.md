# Spec — Phase 1 / Slice 1: API foundation + auth

**Date:** 2026-06-20 · **Status:** Approved → implementing · **Branch:** `phase1/api-foundation-auth`

## Goal
The backend foundation every later slice reuses, plus the first real capability: **multi-user auth**.
Backend only — no UI, no other entities. (OpenAPI + TS client deferred to Slice 2 / Exercises.)

## Stack additions
- **Router:** `chi` (+ middleware: slog request logging, recoverer, real-IP, CORS).
- **DB:** `modernc.org/sqlite` (pure-Go, CGO-free), WAL + `foreign_keys=on`.
- **Migrations:** `goose` (pressly/goose), SQL files embedded via `go:embed`, applied on startup.
- **Queries:** `sqlc` (engine `sqlite`) → type-safe Go from SQL. `sqlc.yaml` + `db/queries/*.sql`.
- **Auth:** `golang.org/x/crypto/argon2` (argon2id), `golang-jwt/jwt/v5`.
- **Logging:** stdlib `slog`. **Config:** env (`GRANITE_*`).

## Layout (apps/api)
```
apps/api/
├─ cmd/granite/main.go        # wire config → db → migrations → router → serve
├─ internal/
│  ├─ config/                 # env config
│  ├─ logging/                # slog setup
│  ├─ apperr/                 # typed error taxonomy + HandleError → {error,code,details}
│  ├─ db/                     # sqlite open (pragmas), migration runner
│  │  ├─ migrations/*.sql     # goose migrations (embedded)
│  │  └─ sqlc/                # generated code (gen.go, models, queries)
│  ├─ auth/                   # password (argon2id), tokens (jwt + refresh rotation), service
│  └─ server/                 # router, middleware, handlers (auth, me, health)
├─ db/queries/*.sql           # sqlc query sources
└─ sqlc.yaml
```

## Schema (migrations)
- `users`: `id` (uuid text), `email` (unique, citext-style lower), `password_hash`, `display_name`,
  `settings` (json text, default '{}'), `created_at`, `updated_at`.
- `refresh_tokens`: `id`, `user_id` (fk), `token_hash`, `expires_at`, `revoked_at` (nullable), `created_at`.
  *(Sync-metadata columns arrive with data entities in later slices, not here.)*

## Endpoints (`/api/v1`)
- `POST /auth/register` — gated by `GRANITE_ALLOW_REGISTRATION`; creates user → returns `{user, access, refresh}`.
- `POST /auth/login` — verify password → tokens.
- `POST /auth/refresh` — rotate: validate refresh (hash lookup, not revoked/expired), revoke old, issue new pair.
- `POST /auth/logout` — revoke the presented refresh token.
- `GET /me` / `PATCH /me` — current user; update `display_name` / `settings`.
- `/healthz`, `/readyz` move under the chi router.

## Auth specifics
- argon2id with sane params; constant-time verify; generic error on bad creds (no user-enumeration).
- Access JWT ~15 min (HS256, `GRANITE_JWT_SECRET`); refresh ~30 days, random opaque token stored **hashed**
  (sha-256) in `refresh_tokens`, **rotated** on every refresh, revocable. Auth middleware → user in ctx.

## Tests (TDD)
- `apperr` → status/code mapping; `config` defaults; `auth` password hash/verify, JWT issue/verify/expiry,
  refresh rotation + revocation + reuse-rejection; registration gating.
- Handler integration tests against a **temp SQLite** (migrations applied) via `httptest`: register→login→
  me→refresh→logout happy paths + failure cases (dupe email, bad password, expired/revoked refresh, gated reg).

## Verification
`GOTOOLCHAIN=auto go vet ./... && go build ./... && go test ./...` green locally; CI green on the PR.

## Out of scope
UI; exercises/routines/workouts; sync; OpenAPI/TS client (Slice 2); OIDC/passkeys; password reset/email.
