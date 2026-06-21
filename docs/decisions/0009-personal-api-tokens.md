# ADR-0009 — Personal API tokens for programmatic access

**Status:** Accepted · 2026-06-21 · extends [ADR-0006](0006-auth-email-password-jwt.md)

## Context
The interactive app authenticates with short-lived JWT access tokens + rotating refresh tokens. Opening
Granite up "for others" (the MCP server, scripts, third-party tools — Phase 5) needs a way for
*non-interactive* clients to authenticate with a stable, user-managed credential, without embedding the
email/password flow.

## Decision
**Personal API tokens**: opaque `gra_`-prefixed bearer tokens, created from an interactive session,
stored only as a **sha-256 hash** (the raw token is shown once), **optionally expiring**, and **revocable
by deletion**. The same Bearer middleware accepts them — a `gra_` prefix routes to the token store,
anything else stays the JWT path — both yielding the same user in context. **Token management
(create/list/revoke) requires an interactive (JWT) session**, so a leaked API token cannot enumerate, mint,
or revoke other tokens.

## Alternatives considered
- **OAuth2 client-credentials / personal OAuth apps** — far too heavy for a single-user, self-hosted tool.
- **Long-lived JWTs** — can't be revoked without a denylist; opaque hashed tokens revoke by simply deleting the row.
- **Scoped tokens (read-only / per-resource)** — deferred; add scopes when the MCP write surface needs them.

## Consequences
- ✅ One auth seam for the app, the REST API, and MCP; tokens are revocable and optionally expiring; the raw secret is never persisted.
- ✅ The `gra_` prefix is greppable by secret scanners and easy to identify on the wire and in the token list.
- ✅ **Scopes** (added 2026-06-21): a token is `read` (the default) or `read,write`; the API enforces the
  write scope on every mutating operation (method-based, so new write endpoints are guarded by default;
  `sync/pull` is excepted as a read-over-POST). Finer-grained per-resource scopes remain future work.
- 🔜 The MCP server will authenticate with these tokens (next Phase 5 slice).
