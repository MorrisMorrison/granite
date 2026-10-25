# 06 — Mobile app (SvelteKit + Capacitor)

> **Status:** the **Android app has shipped** — debug builds from CI today, signed releases on GitHub
> Releases next. iOS comes later (it needs macOS CI). See [ADR-0012](decisions/0012-android-app-capacitor.md).

## Shape

- **SvelteKit**, built with **`adapter-static`** as a single-page app (SPA fallback to `index.html`).
  No SSR at runtime — it must run inside a Capacitor webview and offline.
- **Capacitor** wraps that build into a native Android app (`apps/mobile/android`, app id
  `io.github.morrismorrison.granite`) and provides native plugins. iOS later.
- The **same build** is embedded in the Go binary to serve the self-hosted **web app / PWA**.

```
SvelteKit static build ──┬─► Capacitor ──► Android app (iOS later)
                         └─► embedded in Go binary ──► web app / installable PWA
```

## One codebase, small native surface

Granite is a Svelte web app at its core. The native surface is tiny and isolated to one module,
`apps/mobile/src/lib/platform/native.ts` (rest-timer notification, keep-awake); on the web its calls are
no-ops, so there is no separate UI codebase for web versus mobile.

## Local storage

- **On-device store behind a `SyncStore`/repository seam**, so app code is platform-agnostic.
- **Web/PWA and Android: IndexedDB** via `idb` (inside the WebView on Android) — see
  [ADR-0010](decisions/0010-web-local-store-indexeddb.md). Granite's data is small and aggregate-shaped
  (a routine/workout is one record with its children), so rich on-device SQL isn't needed.
- **Native SQLite** (`@capacitor-community/sqlite`) is only a possible later step — a separate
  `SyncStore` implementation against the same interface.
- All reads/writes hit the local store; the [sync client](05-sync-and-offline.md) reconciles with the server.
- Android cloud backup and device-to-device transfer are disabled (WebView storage holds the refresh
  token); a new device gets its data back by syncing.

## Native capabilities

| Need | Capacitor plugin | Status |
|---|---|---|
| **Rest-timer notification** | `@capacitor/local-notifications` | **Used.** Local notification on a dedicated "Rest timer" channel (high importance), scheduled when a rest starts, rescheduled on ±15 s, cancelled on skip/stop/finish/leaving. Permission is asked on the first rest. Uses exact alarms (`USE_EXACT_ALARM`, Android 13+) and falls back to inexact without sending you to Settings — the in-app alert then stays in charge. An exact native notification replaces the in-app buzz/beep (no double alert). |
| **Keep screen awake** | `@capacitor-community/keep-awake` | **Used** while the workout logger is open. |
| Export/share file | `@capacitor/filesystem` + `@capacitor/share` | Later. |
| Network status | `@capacitor/network` | Later. |
| Haptics | `@capacitor/haptics` | Later. |

Deferred/native-heavy: Apple Health / Google Fit, Apple Watch / Wear OS — the one area where Capacitor is
weaker than React Native (see ADR-0002).

The app needs **Android System WebView 103 or newer** (`minWebViewVersion`).

## Screens (MVP)

- **Today / Home** — start a workout (from routine or empty), resume in-progress.
- **Workout logger** — the hot path: exercises, sets (weight/reps/type/complete), "previous" values,
  rest timer, notes, reorder, supersets. Must be fast and thumb-friendly.
- **Routines** — list (in folders), create/edit a routine, reorder.
- **Exercises** — searchable library, create/edit custom exercises.
- **History** — past workouts; open one.
- **Exercise detail / stats** — history + a simple progress chart + PRs.
- **Settings** — account, **JSON export**, **personal API tokens** (read/write scopes, `gra_` prefix),
  **Change server** (app only), logout. (Units / default-rest preferences planned.)

## Server connection

There is no central Granite cloud; the app talks to **your** server. The web app served by the binary
already knows its own origin, so this applies to the native app only.

- **First launch: "Connect to your server"** (`/connect`, native only). The address is normalised —
  `https://` is added when you type no scheme (type `http://` for a plain-HTTP server).
- **The check:** a `no-cors` probe of `/healthz`, then `GET /api/v1/info` (public;
  `{"name":"granite","api_version":1}`).
- **Errors:** *unreachable*; *not found* (reachable but blocked — a non-Granite site, or a Granite server
  that predates the app); *not Granite*; *outdated* (the server's `api_version` is older than the app needs).
- Sign-in screens show "Server: host · Change". **Settings → Change server** signs out and clears local
  data, and is refused while changes are unsynced.
- **CORS:** the server always allows `https://localhost` (Android WebView) and `capacitor://localhost`
  (iOS, later) in addition to `GRANITE_BASE_URL`. That is safe because auth uses bearer tokens, not cookies.
- **Plain HTTP** works (the app allows cleartext and mixed content), but sends passwords and tokens
  unencrypted — trusted networks only; prefer HTTPS.

## Build & release

- **CI:** [`android.yml`](../.github/workflows/android.yml) builds a **debug APK** on PRs touching the app
  and uploads it as the `granite-debug-apk` artifact (14-day retention) — installable for testing.
- **Next:** signed release APKs on GitHub Releases, one per `v*` tag. iOS later (needs macOS CI).
- **Build locally** (JDK 21 + Android SDK): `pnpm --filter mobile run cap:sync`, then open
  `apps/mobile/android` in Android Studio, or run `./gradlew assembleDebug` there.
