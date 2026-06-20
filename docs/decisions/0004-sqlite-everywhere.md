# ADR-0004 — SQLite on device and server (Postgres optional later)

**Status:** Accepted · 2026-06-20 _(supersedes the earlier "Postgres on server" assumption)_

## Context
Offline-first means **two** databases: one on each device, one on the server. They hold the same
logical schema and are reconciled by sync. The target deployment is a self-hosted instance for **one
person or a household** — trivial write concurrency and tiny data volume (workout logs are small).
Crucially, the **heavy read/stat work happens on the client** (each device has the full local copy), so
the server is mostly durable storage + the sync endpoint + auth.

## Decision
Use **SQLite on both the device and the server.** The whole backend is a single Go binary + one SQLite
file. Keep server storage behind an interface so a **PostgreSQL** backend can be added later for anyone
running a larger shared instance.

## Alternatives considered
- **PostgreSQL on the server.** The "default" choice, but it adds a second process/container to run,
  tune, and back up — for a workload that doesn't need it. Contradicts the "boring to self-host" goal.
- **A replicated embedded store** (rqlite / Turso-style) or **Litestream** for HA. Nice for resilience,
  but extra moving parts; Litestream remains available to self-hosters as an *optional* backup/replication
  layer without being a hard dependency.

## Consequences
- ✅ **One container, one file.** The simplest possible self-host: no database to administer; back up by
  copying a file (or via the in-app JSON export).
- ✅ **One SQL dialect across the whole system** (device + server) → schemas and queries stay aligned,
  and the sync engine reconciles two SQLite databases. Removes the "two dialects to keep in sync" risk.
- ✅ Runs comfortably on a Pi / NAS / small VPS; the client does the heavy lifting.
- ➖ SQLite serializes writes — a non-issue at one-person/household scale (use WAL mode).
- ➖ Not suited to a large multi-writer shared instance → that's what the optional Postgres backend (kept
  behind the storage interface) is for. Out of scope for the target use case.
