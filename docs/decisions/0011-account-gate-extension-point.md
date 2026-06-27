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
  `CanRegister(ctx, email)` and `CanSync(ctx, userID)`. The default
  implementation, `AllowAll`, permits everything.
- The server holds an injectable gate (functional option `server.WithGate`,
  defaulting to `AllowAll`) and consults it in exactly three handlers:
  `POST /auth/register`, `POST /sync/pull`, `POST /sync/push`. A denied action
  returns `403 Forbidden`. Login, refresh, export, account deletion, and read
  endpoints are intentionally **not** gated, so a user can always reach and
  export their own data.
- A new public package `apps/api/app` exposes `Run(ctx, Options)`, encapsulating
  the bootstrap (config, DB, services, HTTP server, graceful shutdown). External
  programs embed Granite by calling `app.Run` with a custom gate, without
  importing `internal/` packages.

## Alternatives considered
- **Patch handlers in a fork.** Rejected — drifts from upstream, high maintenance.
- **A reverse-proxy/sidecar in front.** Works for coarse checks but can't cleanly
  gate signup (which lives inside the app) and duplicates identity handling.
- **Generalize `GRANITE_ALLOW_REGISTRATION` into config flags.** Too rigid for
  arbitrary external policies; an interface is the extensible seam.

## Consequences
- ✅ Default build is unchanged (AllowAll); the seam is a no-op until injected.
- ✅ Clean embedding API; external builds need no `internal/` access.
- ✅ Small, testable surface (interface + three handler checks).
- ➖ The gate runs per request on the gated endpoints; implementations must keep
  `CanSync`/`CanRegister` cheap (cache external lookups).
