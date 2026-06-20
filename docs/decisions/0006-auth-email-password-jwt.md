# ADR-0006 — Email + password + JWT auth

**Status:** Accepted · 2026-06-20

## Context
Offline-first + self-hosted + multi-device. Auth must: work when the app is offline (a logged-in
session shouldn't need the network to keep logging), support multiple users per instance (household),
and be simple to operate on a self-host.

## Decision
**Email + password**, hashed with **argon2id**. Issue a short-lived **JWT access token** + a long-lived
**rotating, revocable refresh token**. **Multi-user (household)**: multiple accounts per instance, all
data scoped by `user_id`, with **registration gated** by `GRANITE_ALLOW_REGISTRATION` (open for first
setup, then lock). No invite system yet.

## Alternatives considered
- **Single-user / no auth (shared secret).** Simplest, but the model is already multi-user-shaped, and
  a token still needs managing; little saved.
- **OIDC (external identity provider).** Great for setups that already run an IdP — but a hard
  dependency for *every* self-hoster at MVP is too much. **Planned as an option later.**
- **Passkeys / WebAuthn.** Excellent UX/security, but trickier with offline-first mobile and a higher
  build cost for MVP. **Planned later.**

## Consequences
- ✅ Simple, universally understood, no external dependency for self-hosters.
- ✅ JWT access token lets the app stay "logged in" and keep logging offline; refresh only when online.
- ➖ Password handling responsibility (hashing, reset flow) is on us — use argon2id, rotate refresh
  tokens, gate registration.
- 🔭 Add **OIDC** and **passkeys** post-MVP without changing the data model.

## Resolution (2026-06-20)
**Multi-user, registration-gated** — chosen over single-user. Supports a household; data is scoped per
user; `GRANITE_ALLOW_REGISTRATION` gates signups (open for first setup, then close). Minimal UX for now
(no invites). Single-user would have been simpler, but the model is already user-scoped so multi-user is
barely more work and avoids a later migration.
