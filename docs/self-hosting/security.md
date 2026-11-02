# Security

## Before you go live

- Serve Granite over HTTPS, with a [reverse proxy](reverse-proxy.md).
- Use a generated `GRANITE_JWT_SECRET`, and keep it out of version control.
- Leave `GRANITE_ALLOW_REGISTRATION=false` unless you want others to sign up.
- Set `GRANITE_TRUSTED_PROXY=true` only behind a proxy that overwrites the client IP headers.
- Don't set `GRANITE_ENV=dev`. It creates a demo account with a known password.
- Keep the instance updated, and [take backups](backups.md).

## How Granite protects your account

- Passwords are hashed with argon2id.
- Login sessions use short-lived tokens with rotating refresh tokens.
- Login and registration are rate limited per IP address.
- API tokens are read-only unless you grant write access.

## The app and the server

Each device keeps a full copy of your data in the browser, so sign out on shared devices. Signing out clears that copy, unless the device has changes it can't sync yet. In that case Granite keeps them, so make sure the device is online first.

## Privacy

Granite sends no telemetry. Your data stays on your server and your devices.

## Report a vulnerability

Please don't open a public issue. See the [security policy](https://github.com/MorrisMorrison/granite/security/policy) for how to report it privately.
