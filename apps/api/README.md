# apps/api — Go backend

The Go service: REST API, the offline-first **sync** engine, and (later) the **MCP** server. Stores
data in an embedded **SQLite** file and embeds the SvelteKit static build to serve the self-hosted web
app — so a self-hoster runs a single binary.

> Not scaffolded yet — see [`/docs`](../../docs/) for the design. Scaffolding lands in Phase 1.

Planned (see [docs/02](../../docs/02-architecture.md), [docs/04](../../docs/04-api-design.md)):
- HTTP + config + logging + a typed error taxonomy (`{error, code, details}` envelope).
- SQLite schema + migrations (core entities with sync metadata).
- Auth (email/password, argon2id, JWT access + rotating refresh).
- OpenAPI spec → generated TS client in `packages/shared`.
- `embed` of the web build for single-binary self-hosting.
