# Security Policy

## Supported versions

Granite is pre-1.0. Security fixes target the latest `main` / most recent image.

## Reporting a vulnerability

**Please do not open a public issue for security problems.**

Use GitHub's private vulnerability reporting:

- Go to the repo's **Security** tab → **Report a vulnerability**, or
- open one directly at
  <https://github.com/MorrisMorrison/granite/security/advisories/new>.

Include what you found, steps to reproduce, and the impact. We'll acknowledge the report and work with
you on a fix and disclosure timeline.

## Self-hosting notes

Granite is meant to run behind your own reverse proxy. To keep an instance safe:

- Set a strong `GRANITE_JWT_SECRET` (≥ 32 bytes; the server refuses to start otherwise) and keep it secret.
- Terminate **TLS** at the proxy.
- Leave `GRANITE_ALLOW_REGISTRATION=false` for a personal instance (the first account still bootstraps).
- Treat personal API tokens (`gra_…`) like passwords; create them read-only unless you need writes.
