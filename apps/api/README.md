# apps/api — Go backend

[![api coverage](https://codecov.io/gh/MorrisMorrison/granite/graph/badge.svg?flag=api)](https://codecov.io/gh/MorrisMorrison/granite)

The Go service: the REST API, the offline-first **sync** engine, auth, and personal API tokens. It
stores data in an embedded **SQLite** file and `go:embed`s the SvelteKit static build to serve the
self-hosted web app — so a self-hoster runs a **single binary**. (An MCP server is a later phase.)

## Layout

```
cmd/granite/         # main entrypoint (the server binary)
cmd/gen-openapi/     # writes openapi.yaml from the Huma API definition
cmd/seed-demo/       # creates a demo account with sample data (idempotent)
internal/
  apperr/            # typed error taxonomy → HTTP status (Huma emits RFC7807 problem JSON)
  auth/              # password hashing, JWTs, refresh tokens, personal API tokens
  config/            # env-var config
  db/                # SQLite open + migrations (sqlc-generated queries; see sqlc.yaml)
  exercise/ routine/ workout/   # domain services
  sync/              # pull/push apply, LWW + tombstones
  server/            # HTTP handlers, middleware, health
  webui/             # go:embed of the SvelteKit build (internal/webui/dist)
  logging/
openapi.yaml         # generated OpenAPI spec — the wire contract (source for the TS client)
```

The HTTP/OpenAPI layer uses **Huma** (see [ADR-0007](../../docs/decisions/0007-huma-openapi.md)): the
Go handlers are the source of truth and `openapi.yaml` is generated from them; CI fails if the committed
spec or the generated TS client drifts.

## Run it

```sh
# From the repo root, the dev script sets a throwaway secret + open registration + a dev DB:
pwsh scripts/dev-api.ps1     # Windows PowerShell
./scripts/dev-api.sh         # macOS / Linux

# Or directly (Go on PATH; go.mod targets 1.25, so let the toolchain self-fetch):
GOTOOLCHAIN=auto go run ./cmd/granite     # or: make run-api
```

## Demo / seed data

Populate an account with realistic data — routines and a few weeks of workout history — for local
development or a try-it-out demo:

```sh
make seed-demo          # from repo root; seeds the dev DB (override with GRANITE_DB_PATH)
# or: cd apps/api && GRANITE_DB_PATH=dev.db go run ./cmd/seed-demo
```

Creates **`demo@granite.local` / `demodata`** with a Push/Pull/Legs folder, three routines, and nine
logged sessions (progressing over ~6 weeks, so the per-exercise charts + PRs are populated). It's
**idempotent** — if the demo account already exists it does nothing.

## Configuration (env vars)

| Var | Purpose |
|---|---|
| `GRANITE_DB_PATH` | SQLite file path (default `granite.db`). |
| `GRANITE_JWT_SECRET` | **Required.** JWT signing secret (≥ the minimum length; generate with `openssl rand -base64 48`). |
| `GRANITE_BASE_URL` | Public URL — links / CORS (default `http://localhost:8080`). |
| `GRANITE_ALLOW_REGISTRATION` | `true`/`false` — gate registration on a personal instance (default `false`). |
| `GRANITE_LOG_LEVEL` | Log level (default `info`). |
| `PORT` | Listen port (default `8080`). |

## Testing

```sh
GOTOOLCHAIN=auto go test ./...     # or: make test-api
```

Go unit + integration tests live next to the code (e.g. `internal/auth/*_test.go`,
`internal/sync` apply tests, and `internal/server/journey_test.go` — an end-to-end HTTP journey).
The sync convergence tests cover nested round-trips, the incremental cursor, last-write-wins, and
idempotency. The full UI e2e suite (Playwright) drives this binary; see the
[mobile README](../mobile/README.md).
