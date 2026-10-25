# Capacitor Android app — design

**Status:** approved 2026-10-25 · **Scope:** first native milestone (Android only)

## Goal

Ship Granite as an installable **Android app** built from the same SvelteKit build as the web app,
with the native behaviour a PWA can't do reliably: a **rest-timer notification that fires with the
screen locked**, and **keeping the screen awake** during a workout. Distribute it as a **signed APK on
GitHub Releases** so anyone can sideload it.

Out of scope for this milestone: iOS (needs macOS CI and an Apple Developer account), app-store
listings, a native SQLite store, health integrations.

## Decisions

| Topic | Decision | Why |
|---|---|---|
| Platform | Android first | Builds entirely on Linux CI; testable on a phone immediately. iOS follows on macOS CI. |
| Distribution | Signed APK attached to a GitHub Release per `v*` tag | Sideloadable today; leaves F-Droid/Play open. |
| Native scope | Web app in a native shell + rest-end local notification + keep-awake | The concrete wins over the PWA. |
| Local data | Stays in IndexedDB inside the WebView | Already works in Android WebView; no second `SyncStore`, no migration. Native SQLite stays a possible later step. |
| Server connection | First-run "Connect to your server" step | The app isn't served by the server, so it must be told where it is once. |
| Cross-origin | The server always allows the native WebView origins in CORS | One code path (normal `fetch`) for web and native. Safe: auth is bearer tokens, not cookies. |

## Architecture

### Layout
- Capacitor lives in `apps/mobile` beside the web app: `capacitor.config.ts` and a committed
  `android/` project. `webDir` is the existing `vite build` output.
- App ID `io.github.morrismorrison.granite`, display name "Granite".

### Platform seam — `src/lib/platform/native.ts`
The only module that touches Capacitor. Plugins are loaded with dynamic `import()` only when native,
so the web build and PWA are unchanged.

| Function | Native | Web |
|---|---|---|
| `isNative()` | `true` | `false` |
| `scheduleRestEnd(at: number)` | schedules a local notification at `at` (replacing any pending one) | no-op (the in-app alert stays as today) |
| `cancelRestEnd()` | cancels the pending notification | no-op |
| `keepAwake(on: boolean)` | keep-awake plugin on/off | no-op |

App code calls the seam, never Capacitor directly.

### Connect to your server (native only)
- Route `/connect`. On native, any route redirects there while no server URL is saved.
- The URL is normalised (add `https://` when no scheme is given, drop a trailing slash), then checked:
  1. `GET {url}/healthz` answers, and
  2. `GET {url}/api/v1/info` returns `{ "name": "granite", "api_version": n }` with
     `n >= MIN_API_VERSION` (1).
- On success the URL is saved to `granite.serverUrl` (the key `getServerUrl()` already reads) and the
  app continues to login/register. Those screens show "Server: <host> · Change" on native.
- **Changing server** signs out and clears local data (the existing reset), so data from two servers
  never mixes. If sign-out is refused because changes haven't synced yet, the switch is refused too.
- `/connect` exists only in the native app; on the web it redirects to login.
- Errors, in plain words:

| Situation | Message |
|---|---|
| Nothing answers / DNS / timeout | "No server answered at <host>. Check the address and your connection." |
| Answers, but the identity check is blocked by CORS (any non-Granite site, or a Granite server that predates the app — browsers can't tell these apart) | "No current Granite server found at <host>. Check the address, or update the server." |
| Identity check answers with something that isn't Granite | "That address doesn't look like a Granite server." |
| `api_version` below the app's minimum | "This Granite server needs an update to work with the app." |

### Server changes
- CORS allow-list = `GRANITE_BASE_URL` **plus** `https://localhost` (Android WebView) and
  `capacitor://localhost` (iOS, later). Always on, no setting.
- New public endpoint `GET /api/v1/info` → `{ "name": "granite", "api_version": 1 }` (huma may add `$schema`).
  `api_version` is bumped when the app starts relying on newer server behaviour.

### Native features
- **Rest timer:** when rest starts, `scheduleRestEnd(endsAt)` schedules "Rest over — next set". ±15 s
  reschedules; skip, stop, finishing and leaving the workout cancel it. Notification permission is
  requested the first time a rest starts. The existing wall-clock timer stays the source of truth.
- **Keep awake:** on while the workout logger is open; released when leaving it or finishing.

## Build & release

- Workflow `.github/workflows/android.yml` on GitHub-hosted `ubuntu-latest`, JDK 21, Android SDK.
- **Pull requests** touching `apps/mobile/**`: `pnpm build` → `cap sync android` →
  `./gradlew assembleDebug`; the debug APK is uploaded as a workflow artifact.
- **`v*` tags:** the same plus `assembleRelease`, signed with the release keystore from repository
  secrets; `granite-<version>.apk` is attached to the GitHub Release for the tag.
- `versionName` = tag without `v`; `versionCode` = major×10000 + minor×100 + patch, so updates install
  over older versions.

### Signing
- One release keystore, generated once and never rotated (Android refuses updates signed with a
  different key). It must be backed up outside the repository.
- Repository secrets: `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`,
  `ANDROID_KEY_PASSWORD`. Nothing secret is committed.

## Testing

- **Unit:** URL normalisation and the connect check (each error case), the platform seam (web
  fallbacks; native plugin calls mocked), rest-notification schedule / reschedule / cancel.
- **Component:** `/connect` states — checking, connected, not Granite, needs update, unreachable.
- **e2e:** an e2e-only build flag makes the web build behave as native (production builds ignore it),
  covering connect → login → change server → local data cleared.
- **Go:** CORS headers for `https://localhost` and `capacitor://localhost`; `/api/v1/info` shape.
- **Manual smoke** on a real phone with the first APK: install, connect, log a set, rest notification
  with the screen locked, screen stays on.

## Delivery (small PRs)

1. **Server:** native origins in CORS + `GET /api/v1/info` (+ this spec).
2. **App:** platform seam + connect flow + tests (web unaffected).
3. **Capacitor scaffold:** `android/`, rest notification, keep-awake, debug-APK CI job.
4. **Release:** signed builds on tags, docs (ADR-0012, `06-mobile-app.md`, `07-self-hosting.md`,
   README download link). Needs the keystore secrets.
