# ADR-0011 — Account authorization extension point (AccountGate)

**Status:** Accepted · 2026-06-27

## Context
Registration and sync are always-allowed in the core server (gated only by the
existing `GRANITE_ALLOW_REGISTRATION` flag). Some deployments need to enforce
their own authorization policy on *who* may create an account or sync — an invite
allowlist, an SSO/identity entitlement, or some other external check — without
forking the project or patching handlers. We want one small, well-defined seam
for that, and we want the default build to behave exactly as before.

## Decision
- A new public package `apps/api/gate` defines `AccountGate` with two methods:
  `CanRegister(ctx, email)` and `CanWrite(ctx, userID)`. The default
  implementation, `AllowAll`, permits everything.
- Registration is unauthenticated, so the register handler consults `CanRegister`
  directly. All other gating is centralized: the auth middleware consults
  `CanWrite` on every *mutating* operation — those whose HTTP method writes and
  that aren't marked `readOnly`. This single check covers sync push, bulk import,
  and all CRUD writes, so no write path can bypass the gate. A denied action
  returns `403 Forbidden`.
- Reads stay open: every `GET`, plus `sync/pull` (a read over `POST`, flagged
  `readOnly`) and `export`, are ungated. An unentitled account is therefore
  effectively read-only and can always reach and export its own data.
- A new public package `apps/api/app` exposes `Run(ctx, Options)`, encapsulating
  the bootstrap (config, DB, services, HTTP server, graceful shutdown). External
  programs embed Granite by calling `app.Run` with a custom gate, without
  importing `internal/` packages.

## Alternatives considered
- **Patch handlers in a fork.** Rejected — drifts from upstream, high maintenance.
- **Per-handler gate checks.** Rejected — easy to forget a write path (import and
  CRUD were missed in an early draft); the method-based middleware check guards new
  write endpoints by default.
- **A reverse-proxy/sidecar in front.** Works for coarse checks but can't cleanly
  gate signup (which lives inside the app) and duplicates identity handling.

## Consequences
- ✅ Default build is unchanged (AllowAll); the seam is a no-op until injected.
- ✅ Every mutating endpoint is gated in one place; new write routes are covered by
  default (method-based), so the boundary can't silently regress.
- ✅ Clean embedding API; external builds need no `internal/` access.
- ➖ The gate runs per request on mutating endpoints; implementations must keep
  `CanWrite`/`CanRegister` cheap (cache external lookups).
