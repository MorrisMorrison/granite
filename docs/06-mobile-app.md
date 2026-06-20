# 06 — Mobile app (SvelteKit + Capacitor)

## Shape

- **SvelteKit**, built with **`adapter-static`** as a single-page app (SPA fallback to `index.html`).
  No SSR at runtime — it must run inside a Capacitor webview and offline.
- **Capacitor** wraps that build into native iOS/Android apps and provides native plugins.
- The **same build** is embedded in the Go binary to serve the self-hosted **web app / PWA**.

```
SvelteKit static build ──┬─► Capacitor ──► iOS app / Android app   (app stores, sideload)
                         └─► embedded in Go binary ──► web app / installable PWA
```

## Why this works for a web/backend dev

You're essentially writing a **Svelte web app** — familiar territory. The genuinely "mobile" surface
is small and isolated to a few Capacitor plugins. No React, no Dart, no second UI codebase for web.

## Local storage

- **SQLite on device:** `@capacitor-community/sqlite` on native; `wa-sqlite` (WASM + OPFS) on web.
- A thin data-access layer hides which backend is in use, so app code is platform-agnostic.
- All reads/writes hit local SQLite; the [sync client](05-sync-and-offline.md) reconciles with the server.

## Native capabilities we actually need (and the plugin)

| Need | Capacitor plugin | Notes |
|---|---|---|
| Local DB | `@capacitor-community/sqlite` | The core. |
| **Rest-timer notification** | `@capacitor/local-notifications` | Schedule a notification for rest-end; fires with screen locked. (All frameworks hit the same iOS background limits — scheduling a local notification is the standard pattern.) |
| Keep timer accurate | wall-clock math on resume | Don't trust `setInterval` in background; compute from a stored end-timestamp. |
| Export/share file | `@capacitor/filesystem` + `@capacitor/share` | JSON export. |
| Network status | `@capacitor/network` | Trigger sync on regain. |
| Haptics (nice-to-have) | `@capacitor/haptics` | Set-complete feedback. |

Deferred/native-heavy (post-MVP): Apple Health / Google Fit, Apple Watch / Wear OS — these are the
one area where Capacitor is weaker than React Native. Out of MVP by design (see ADR-0002).

## Screens (MVP)

- **Today / Home** — start a workout (from routine or empty), resume in-progress.
- **Workout logger** — the hot path: exercises, sets (weight/reps/type/complete), "previous" values,
  rest timer, notes, reorder, supersets. Must be fast and thumb-friendly.
- **Routines** — list (in folders), create/edit a routine, reorder.
- **Exercises** — searchable library, create/edit custom exercises.
- **History** — past workouts; open one.
- **Exercise detail / stats** — history + a simple progress chart + PRs.
- **Settings** — units, default rest, account, server URL, export, logout.

## Server connection

- The app stores a **server base URL** (your self-host) + the JWT. Self-hosters point it at their own
  instance; there is no central Granite cloud.
- The web app served by the binary already knows its own origin.

## Build & release (later phase)

- The JS build + Capacitor sync run in CI or on a dev machine.
- iOS builds need macOS (CI or a Mac) — defer until app-store time; **PWA-first** means we get a real,
  installable app for testing long before touching Xcode.

## PWA-first strategy

1. Ship the SvelteKit app as an **installable PWA** (served by the Go binary). Fully offline, real
   SQLite (WASM), testable on a phone immediately — **zero app-store friction.**
2. Add the **Capacitor native wrappers** when we want store presence + the most reliable
   local-notification behavior. Same code; it's a packaging step, not a rewrite.
