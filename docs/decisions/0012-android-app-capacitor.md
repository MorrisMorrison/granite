# ADR-0012 — Android app via Capacitor

**Status:** Accepted · 2026-10-25 · implements [ADR-0002](0002-mobile-capacitor-sveltekit.md) for Android

## Context
The PWA can't alert reliably when the screen is locked: a web page can't schedule a
notification for the end of a rest, so the rest timer goes silent exactly when you put the
phone down between sets. [ADR-0002](0002-mobile-capacitor-sveltekit.md) already chose
SvelteKit + Capacitor so the same static build could be wrapped natively; this decision is
the first native target and the shape of that wrapper.

## Decision
- **Android first, via Capacitor 8.** The app (`apps/mobile/android`) embeds the same static
  build the Go binary serves. iOS follows later.
- **Keep IndexedDB** as the on-device store ([ADR-0010](0010-web-local-store-indexeddb.md))
  inside the WebView; no native database.
- **One native seam**: all native code lives in `apps/mobile/src/lib/platform/native.ts`
  (local notifications, keep-awake). On the web every call is a no-op, so app code calls it
  unconditionally.
- **Connect step.** There is no central Granite cloud, so first launch asks for your server
  address and checks it: a `no-cors` probe of `/healthz`, then the public
  `GET /api/v1/info` (`{"name":"granite","api_version":1}`). The server is rejected if it
  isn't Granite or its `api_version` is older than the app needs.
- **Native origins are always in CORS**: `https://localhost` (Android WebView) and
  `capacitor://localhost` (iOS, later), in addition to `GRANITE_BASE_URL`. Self-hosters
  configure nothing.
- **Rest notifications use exact alarms** (`USE_EXACT_ALARM`, Android 13+) and fall back to
  inexact ones without sending the user to Settings; the in-app alert then stays in charge.
- **Distribution:** a signed APK on GitHub Releases per `v*` tag. CI builds debug APKs on
  PRs today; the release workflow follows.

## Alternatives considered
- **Native HTTP plugin instead of CORS.** Rejected — a second network path to maintain, and
  CORS is already safe with bearer tokens.
- **Native SQLite store.** Rejected for now — IndexedDB already works in the WebView and the
  data is small; it stays a possible later step.
- **iOS first.** Rejected — needs macOS CI and an Apple developer account before anyone can
  install a test build.

## Consequences
- ✅ Reliable rest-timer alerts with the screen locked, with no second UI codebase.
- ✅ Self-hosting stays zero-config for the app: any up-to-date server works.
- ➖ iOS needs macOS CI and an Apple account.
- ➖ The release keystore must never change, or updates won't install over existing installs.
- ➖ Bump `api_version` whenever the app needs newer server behaviour, so older servers get a
  clear "needs an update" instead of failing mysteriously.
- ➖ `USE_EXACT_ALARM` would need revisiting for a Play Store listing.
- ➖ Plain-HTTP servers (e.g. on a home LAN) are supported for convenience, which trades
  encryption for ease: passwords and tokens travel unencrypted, so trusted networks only.
