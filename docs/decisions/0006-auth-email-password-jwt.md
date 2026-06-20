# ADR-0006 — Email + password + JWT auth

**Status:** Proposed · 2026-06-20 _(default chosen for the plan; open to change before Phase 1)_

## Context
Offline-first + self-hosted + multi-device. Auth must: work when the app is offline (a logged-in
session shouldn't need the network to keep logging), support multiple users per instance (household),
and be simple to operate on a self-host.

## Decision (proposed)
**Email + password**, hashed with **argon2id**. Issue a short-lived **JWT access token** + a long-lived
**rotating, revocable refresh token**. All data scoped by `user_id`. Registration gated by an env flag
/ invite for personal instances.

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

## Open question
Is a personal instance effectively **single-user**, or should we invest early in **household/multi-user**
UX (invites, registration)? The data model supports multi-user regardless; this only affects how much
onboarding UX we build up front. Default assumption: multi-user-capable, registration gated.
