# Capacitor Android App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Granite as a sideloadable, signed Android app (Capacitor) built from the existing SvelteKit build, with a "Connect to your server" first step, a rest-over notification and keep-awake.

**Architecture:** Capacitor lives in `apps/mobile` next to the web app. One module (`src/lib/platform/native.ts`) is the only code that touches Capacitor; on the web every call is a no-op, so the PWA is unchanged. The server always allows the native WebView origins in CORS and exposes a public `GET /api/v1/info` so the app can recognise a Granite server.

**Tech Stack:** Go (chi + huma) · SvelteKit 3 / Svelte 5 · Capacitor 8.5 (`@capacitor/core`, `@capacitor/cli`, `@capacitor/android`, `@capacitor/local-notifications` 8.3, `@capacitor-community/keep-awake` 8.0) · GitHub Actions (JDK 21, Android SDK) · Vitest · Playwright.

Spec: `docs/superpowers/specs/2026-10-25-capacitor-android-design.md`.

## Global Constraints

- Android first; iOS is out of scope (only its origin `capacitor://localhost` is pre-allowed).
- App ID `io.github.morrismorrison.granite`, app name `Granite`.
- Native WebView origins always allowed in CORS: `https://localhost`, `capacitor://localhost`.
- `GET /api/v1/info` is public and returns exactly `{ "name": "granite", "api_version": 1 }`; the app requires `api_version >= 1` (`MIN_API_VERSION = 1`).
- Server URL is stored under the existing key `granite.serverUrl` (read by `getServerUrl()` in `src/lib/config.ts`).
- Local data stays in IndexedDB (no native SQLite).
- `versionName` = tag without `v`; `versionCode` = major×10000 + minor×100 + patch.
- Signing secrets: `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`. Nothing secret committed.
- Public repo: no personal infrastructure details in code, docs or commits.
- Imports in the app use `#lib/...` with explicit `.ts` extensions (SvelteKit 3 convention); test files next to sources import relatively without extension (`./calc`).
- Error copy (verbatim):
  - unreachable: `No server answered at <host>. Check the address and your connection.`
  - not Granite: `That address doesn't look like a Granite server.`
  - outdated: `This Granite server needs an update to work with the app.`
  - invalid input: `Enter your server's address, e.g. granite.example.com.`
- Each PR: green CI, squash-merge (standing OK), run the related tests locally first. Revert `apps/api/internal/webui/dist/index.html` after any local e2e build.

---

## PR 1 — Server: native origins + `/api/v1/info`

### Task 1: Always allow the native WebView origins in CORS

**Files:**
- Modify: `apps/api/internal/server/server.go` (setupRouter, CORS block ~line 114)
- Test: `apps/api/internal/server/cors_test.go` (new)

**Interfaces:**
- Produces: exported `var NativeAppOrigins = []string{"https://localhost", "capacitor://localhost"}` in package `server`.

- [ ] **Step 1: Write the failing test** — `apps/api/internal/server/cors_test.go`:

```go
package server

import (
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"github.com/MorrisMorrison/granite/apps/api/internal/auth"
	"github.com/MorrisMorrison/granite/apps/api/internal/db"
	"github.com/MorrisMorrison/granite/apps/api/internal/db/sqlc"
	"github.com/MorrisMorrison/granite/apps/api/internal/exercise"
	"github.com/MorrisMorrison/granite/apps/api/internal/routine"
	syncpkg "github.com/MorrisMorrison/granite/apps/api/internal/sync"
	"github.com/MorrisMorrison/granite/apps/api/internal/workout"
)

// A server configured for one web origin, like production (GRANITE_BASE_URL).
func newOriginServer(t *testing.T, origin string) http.Handler {
	t.Helper()
	database, err := db.Open(filepath.Join(t.TempDir(), "cors.db"))
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	t.Cleanup(func() { _ = database.Close() })
	if err := db.Migrate(database); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	q := sqlc.New(database)
	tokens := auth.NewTokenManager("test-secret")
	return New(auth.NewService(q, tokens, true), exercise.NewService(q), routine.NewService(database, q),
		workout.NewService(database, q), syncpkg.NewService(database, q), tokens, database, []string{origin}).Handler()
}

func preflight(h http.Handler, origin string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodOptions, "/api/v1/auth/login", nil)
	req.Header.Set("Origin", origin)
	req.Header.Set("Access-Control-Request-Method", http.MethodPost)
	req.Header.Set("Access-Control-Request-Headers", "content-type")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

func TestCORSAllowsNativeAppOrigins(t *testing.T) {
	h := newOriginServer(t, "https://granite.example.com")
	for _, origin := range []string{"https://granite.example.com", "https://localhost", "capacitor://localhost"} {
		if got := preflight(h, origin).Header().Get("Access-Control-Allow-Origin"); got != origin {
			t.Errorf("origin %s: Access-Control-Allow-Origin = %q, want %q", origin, got, origin)
		}
	}
}

func TestCORSRejectsOtherOrigins(t *testing.T) {
	h := newOriginServer(t, "https://granite.example.com")
	if got := preflight(h, "https://evil.example").Header().Get("Access-Control-Allow-Origin"); got != "" {
		t.Errorf("unexpected Access-Control-Allow-Origin %q for a foreign origin", got)
	}
}
```

- [ ] **Step 2: Run it to see it fail**

Run (bash, `apps/api`): `export PATH="$PATH:/c/Users/MORRIS~1/AppData/Local/goportable/go/bin" GOTOOLCHAIN=auto; go test ./internal/server -run TestCORS -v`
Expected: `TestCORSAllowsNativeAppOrigins` FAILS for `https://localhost` and `capacitor://localhost` (empty header); `TestCORSRejectsOtherOrigins` passes.

- [ ] **Step 3: Implement** — in `server.go`, above `func (s *Server) setupRouter`, add:

```go
// NativeAppOrigins are the origins the Capacitor apps' WebViews run on (Android
// serves the app from https://localhost, iOS from capacitor://localhost). They're
// always allowed so the native apps work against any self-hosted server without
// configuration; auth is bearer tokens, not cookies, so this exposes no session.
var NativeAppOrigins = []string{"https://localhost", "capacitor://localhost"}
```

and change the CORS options line `AllowedOrigins: allowedOrigins,` to:

```go
		AllowedOrigins: append(slices.Clone(allowedOrigins), NativeAppOrigins...),
```

Add `"slices"` to the import block.

- [ ] **Step 4: Run the tests**

Run: `go test ./internal/server -run TestCORS -v` → PASS. Then `go test ./...` → all PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/internal/server/server.go apps/api/internal/server/cors_test.go
git commit -m "feat(api): always allow the native app origins in CORS"
```

### Task 2: Public `GET /api/v1/info`

**Files:**
- Modify: `apps/api/internal/server/server_info.go`
- Modify: `apps/api/internal/server/server_info_test.go`
- Regenerate: `apps/api/openapi.yaml`, `packages/shared/src/api/schema.d.ts`

**Interfaces:**
- Produces: `GET /api/v1/info` → `200 {"name":"granite","api_version":1}`, no auth. Constant `const APIVersion = 1` in package `server`.

- [ ] **Step 1: Write the failing test** — append to `server_info_test.go`:

```go
func TestInfoIsPublicAndIdentifiesGranite(t *testing.T) {
	h, _ := newTestServer(t)
	rec := doReq(t, h, http.MethodGet, "/api/v1/info", "", nil) // no token
	if rec.Code != http.StatusOK {
		t.Fatalf("info = %d: %s", rec.Code, rec.Body)
	}
	var out struct {
		Name       string `json:"name"`
		APIVersion int    `json:"api_version"`
	}
	mustJSON(t, rec, &out)
	if out.Name != "granite" || out.APIVersion != 1 {
		t.Fatalf("info = %+v, want name=granite api_version=1", out)
	}
}
```

- [ ] **Step 2: Run it** — `go test ./internal/server -run TestInfoIsPublic -v` → FAIL (404).

- [ ] **Step 3: Implement** — in `server_info.go` add to `registerServerInfoRoutes` (after the existing registration):

```go
	huma.Register(a, huma.Operation{
		OperationID: "info",
		Method:      http.MethodGet,
		Path:        "/api/v1/info",
		Summary:     "Public identity check (lets an app confirm it reached a Granite server)",
		Tags:        []string{"Server"},
	}, s.handleInfo)
```

and below the file's existing code:

```go
// APIVersion is bumped when clients (the native apps) start relying on newer
// server behaviour; the app refuses servers below its minimum.
const APIVersion = 1

type infoOutput struct {
	Body struct {
		Name       string `json:"name"`
		APIVersion int    `json:"api_version"`
	}
}

func (s *Server) handleInfo(_ context.Context, _ *struct{}) (*infoOutput, error) {
	out := &infoOutput{}
	out.Body.Name = "granite"
	out.Body.APIVersion = APIVersion
	return out, nil
}
```

Update the comment above `registerServerInfoRoutes` to: `// registerServerInfoRoutes wires the public identity check and the instance-info\n// endpoint clients use to detect a server reset.`

- [ ] **Step 4: Run the tests** — `go test ./internal/server -v -run 'TestInfo|TestServerInfo'` → PASS; `go test ./...` → PASS.

- [ ] **Step 5: Regenerate the OpenAPI spec and TS client** (CI fails on drift)

```bash
cd apps/api && go run ./cmd/gen-openapi > openapi.yaml && cd ../..
corepack pnpm --filter @granite/shared exec openapi-typescript ../../apps/api/openapi.yaml -o src/api/schema.d.ts
git diff --stat   # expect openapi.yaml + schema.d.ts to change; revert any pure-CRLF churn with git checkout --
```

- [ ] **Step 6: Commit and open PR 1** (with the spec + this plan, already committed on the branch)

```bash
git add apps/api/internal/server/server_info.go apps/api/internal/server/server_info_test.go apps/api/openapi.yaml packages/shared/src/api/schema.d.ts docs/superpowers/plans/2026-10-25-capacitor-android.md
git commit -m "feat(api): public GET /api/v1/info for app server detection"
git push -u origin feat/native-cors-info
gh pr create --title "feat(api): native app origins in CORS + public /api/v1/info" --body "<summary, tests>"
```

Wait for green CI, squash-merge.

---

## PR 2 — App: platform seam + connect flow (web unaffected)

Branch `feat/native-connect` from updated `main`.

### Task 3: Platform seam with web fallbacks

**Files:**
- Create: `apps/mobile/src/lib/platform/native.ts`
- Test: `apps/mobile/src/lib/platform/native.test.ts`
- Modify: `apps/mobile/package.json` (add `@capacitor/core` ^8.5.3 to `dependencies`)
- Modify: `apps/mobile/e2e/serve.mjs` (build env `VITE_E2E=1`)

**Interfaces:**
- Produces: `isNative(): boolean`; `scheduleRestEnd(at: number): Promise<void>`; `cancelRestEnd(): Promise<void>`; `keepAwake(on: boolean): Promise<void>`. In e2e builds only (`import.meta.env.VITE_E2E === '1'`), `localStorage['granite.forceNative'] === '1'` makes `isNative()` true. Plugin calls are no-ops unless `Capacitor.isNativePlatform()` (real device) — the e2e override never loads plugins.

- [ ] **Step 1: Add the dependency**

```bash
cd apps/mobile && corepack pnpm add @capacitor/core@^8.5.3
```

- [ ] **Step 2: Write the failing test** — `native.test.ts` (plain `*.test.ts` files run in Vitest's node environment, so this one opts into jsdom for `localStorage`):

```ts
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: vi.fn(() => false) } }));

import { Capacitor } from '@capacitor/core';
import { cancelRestEnd, isNative, keepAwake, scheduleRestEnd } from './native';

afterEach(() => {
	localStorage.clear();
	vi.unstubAllEnvs();
});

describe('platform seam on the web', () => {
	it('is not native and every native call is a harmless no-op', async () => {
		expect(isNative()).toBe(false);
		await expect(scheduleRestEnd(Date.now() + 60_000)).resolves.toBeUndefined();
		await expect(cancelRestEnd()).resolves.toBeUndefined();
		await expect(keepAwake(true)).resolves.toBeUndefined();
	});

	it('honours the e2e override only in e2e builds', () => {
		localStorage.setItem('granite.forceNative', '1');
		expect(isNative()).toBe(false); // not an e2e build
		vi.stubEnv('VITE_E2E', '1');
		expect(isNative()).toBe(true);
	});

	it('reports native on a real device', () => {
		vi.mocked(Capacitor.isNativePlatform).mockReturnValueOnce(true);
		expect(isNative()).toBe(true);
	});
});
```

- [ ] **Step 3: Run it** — `corepack pnpm exec vitest run src/lib/platform/native.test.ts` → FAIL (module not found).

- [ ] **Step 4: Implement** — `native.ts` (the plugin bodies are filled in by Task 7; here they're guarded no-ops on the web):

```ts
import { Capacitor } from '@capacitor/core';

// The only module that touches Capacitor. On the web (and the PWA) every call is a
// no-op, so app code can call these unconditionally. Plugins are imported lazily
// and only on a real device.

const FORCE_NATIVE = 'granite.forceNative';

/** Running inside the native app. e2e builds can force it to exercise native-only UI. */
export function isNative(): boolean {
	if (Capacitor.isNativePlatform()) return true;
	if (import.meta.env.VITE_E2E !== '1') return false;
	try {
		return localStorage.getItem(FORCE_NATIVE) === '1';
	} catch {
		return false;
	}
}

const device = () => Capacitor.isNativePlatform();

/** Schedule the "rest over" notification at epoch-ms `at` (replaces a pending one). */
export async function scheduleRestEnd(at: number): Promise<void> {
	if (!device()) return;
	void at;
}

/** Cancel a pending rest notification. */
export async function cancelRestEnd(): Promise<void> {
	if (!device()) return;
}

/** Keep the screen on (logger open) or let it sleep again. */
export async function keepAwake(on: boolean): Promise<void> {
	if (!device()) return;
	void on;
}
```

Add to `src/vite-env.d.ts` (create if missing, or the existing `src/app.d.ts` `ImportMetaEnv` block):

```ts
interface ImportMetaEnv {
	readonly VITE_E2E?: string;
	readonly VITE_GRANITE_API?: string;
}
```

(Check `src/app.d.ts` first; if `ImportMetaEnv` is already declared there, add `VITE_E2E` to it instead.)

- [ ] **Step 5: e2e builds set the flag** — in `e2e/serve.mjs` change the SPA build call to:

```js
	run('corepack', ['pnpm', 'build'], { cwd: mobileDir, env: { ...process.env, VITE_E2E: '1' } });
```

- [ ] **Step 6: Run** — `corepack pnpm exec vitest run src/lib/platform/native.test.ts` → PASS; `corepack pnpm check` → 0 errors.

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/package.json pnpm-lock.yaml apps/mobile/src/lib/platform apps/mobile/e2e/serve.mjs apps/mobile/src/app.d.ts
git commit -m "feat(mobile): platform seam for native features (web no-ops)"
```

### Task 4: Server URL helpers + connect check

**Files:**
- Modify: `apps/mobile/src/lib/config.ts`
- Create: `apps/mobile/src/lib/connect.ts`
- Test: `apps/mobile/src/lib/connect.test.ts`

**Interfaces:**
- Produces (config.ts): `hasServerUrl(): boolean`; `setServerUrl(url: string): void`; `clearServerUrl(): void`.
- Produces (connect.ts): `normalizeServerUrl(input: string): string | null`; `type ConnectResult = { ok: true; url: string } | { ok: false; reason: 'invalid' | 'unreachable' | 'not-granite' | 'outdated' }`; `checkServer(input: string, fetchFn?: typeof fetch): Promise<ConnectResult>`; `connectMessage(reason, input): string`; `MIN_API_VERSION = 1`.

- [ ] **Step 1: Write the failing tests** — `connect.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { checkServer, connectMessage, normalizeServerUrl } from './connect';

describe('normalizeServerUrl', () => {
	it('adds https, drops trailing slashes and paths, keeps ports', () => {
		expect(normalizeServerUrl('granite.example.com')).toBe('https://granite.example.com');
		expect(normalizeServerUrl(' https://granite.example.com/ ')).toBe('https://granite.example.com');
		expect(normalizeServerUrl('http://192.168.1.5:8080/')).toBe('http://192.168.1.5:8080');
		expect(normalizeServerUrl('https://example.com/granite/')).toBe('https://example.com/granite');
	});

	it('rejects empty or unparseable input', () => {
		expect(normalizeServerUrl('')).toBeNull();
		expect(normalizeServerUrl('   ')).toBeNull();
		expect(normalizeServerUrl('ftp://x')).toBeNull();
		expect(normalizeServerUrl('not a url')).toBeNull();
	});
});

// fetch stub: healthz (no-cors probe) and info (cors) answer per scenario.
function stub(opts: { reachable: boolean; info?: 'cors-blocked' | Response }) {
	return vi.fn(async (url: string, init?: RequestInit) => {
		if (!opts.reachable) throw new TypeError('Failed to fetch');
		if (url.endsWith('/healthz')) {
			expect(init?.mode).toBe('no-cors');
			return new Response(null, { status: 200 });
		}
		if (opts.info === 'cors-blocked') throw new TypeError('Failed to fetch');
		return opts.info!;
	}) as unknown as typeof fetch;
}
const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('checkServer', () => {
	it('accepts a current Granite server', async () => {
		const r = await checkServer('granite.example.com', stub({ reachable: true, info: json({ name: 'granite', api_version: 1 }) }));
		expect(r).toEqual({ ok: true, url: 'https://granite.example.com' });
	});

	it('flags invalid input without fetching', async () => {
		const f = stub({ reachable: true });
		expect(await checkServer('  ', f)).toEqual({ ok: false, reason: 'invalid' });
		expect(f).not.toHaveBeenCalled();
	});

	it('flags an unreachable host', async () => {
		expect(await checkServer('down.example', stub({ reachable: false }))).toEqual({ ok: false, reason: 'unreachable' });
	});

	it('treats a CORS-blocked info call on a reachable host as an outdated server', async () => {
		expect(await checkServer('old.example', stub({ reachable: true, info: 'cors-blocked' }))).toEqual({ ok: false, reason: 'outdated' });
	});

	it('flags a too-old api_version as outdated', async () => {
		const r = await checkServer('old.example', stub({ reachable: true, info: json({ name: 'granite', api_version: 0 }) }));
		expect(r).toEqual({ ok: false, reason: 'outdated' });
	});

	it('flags something that is not Granite', async () => {
		expect(await checkServer('x.example', stub({ reachable: true, info: json({ hello: 'world' }) }))).toEqual({ ok: false, reason: 'not-granite' });
		expect(await checkServer('x.example', stub({ reachable: true, info: new Response('<html>', { status: 200 }) }))).toEqual({ ok: false, reason: 'not-granite' });
		expect(await checkServer('x.example', stub({ reachable: true, info: json({}, 404) }))).toEqual({ ok: false, reason: 'not-granite' });
	});
});

describe('connectMessage', () => {
	it('uses the exact copy', () => {
		expect(connectMessage('unreachable', 'https://down.example')).toBe('No server answered at down.example. Check the address and your connection.');
		expect(connectMessage('not-granite', 'x')).toBe("That address doesn't look like a Granite server.");
		expect(connectMessage('outdated', 'x')).toBe('This Granite server needs an update to work with the app.');
		expect(connectMessage('invalid', '')).toBe("Enter your server's address, e.g. granite.example.com.");
	});
});
```

- [ ] **Step 2: Run** — `corepack pnpm exec vitest run src/lib/connect.test.ts` → FAIL (module not found).

- [ ] **Step 3: Implement** — `connect.ts`:

```ts
// The native app's "Connect to your server" check. A CORS-blocked request fails
// exactly like an unreachable host, so reachability is probed first with a no-cors
// request (works against any server), then identity with a normal request: reachable
// but blocked means the server predates native-app support.

export const MIN_API_VERSION = 1;

export type ConnectFailure = 'invalid' | 'unreachable' | 'not-granite' | 'outdated';
export type ConnectResult = { ok: true; url: string } | { ok: false; reason: ConnectFailure };

/** Normalise user input to `scheme://host[:port][/path]` without a trailing slash; null if unusable. */
export function normalizeServerUrl(input: string): string | null {
	const raw = input.trim();
	if (!raw) return null;
	const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
	let u: URL;
	try {
		u = new URL(withScheme);
	} catch {
		return null;
	}
	if ((u.protocol !== 'https:' && u.protocol !== 'http:') || !u.hostname || /\s/.test(raw)) return null;
	return `${u.protocol}//${u.host}${u.pathname.replace(/\/+$/, '')}`;
}

export async function checkServer(input: string, fetchFn: typeof fetch = fetch): Promise<ConnectResult> {
	const url = normalizeServerUrl(input);
	if (!url) return { ok: false, reason: 'invalid' };
	try {
		await fetchFn(`${url}/healthz`, { mode: 'no-cors', cache: 'no-store' });
	} catch {
		return { ok: false, reason: 'unreachable' };
	}
	let res: Response;
	try {
		res = await fetchFn(`${url}/api/v1/info`, { cache: 'no-store' });
	} catch {
		return { ok: false, reason: 'outdated' };
	}
	if (!res.ok) return { ok: false, reason: 'not-granite' };
	let body: { name?: unknown; api_version?: unknown };
	try {
		body = await res.json();
	} catch {
		return { ok: false, reason: 'not-granite' };
	}
	if (body.name !== 'granite') return { ok: false, reason: 'not-granite' };
	if (typeof body.api_version !== 'number' || body.api_version < MIN_API_VERSION) return { ok: false, reason: 'outdated' };
	return { ok: true, url };
}

/** User-facing copy for a failed check. */
export function connectMessage(reason: ConnectFailure, input: string): string {
	switch (reason) {
		case 'unreachable': {
			const host = normalizeServerUrl(input);
			return `No server answered at ${host ? new URL(host).host : input.trim()}. Check the address and your connection.`;
		}
		case 'not-granite':
			return "That address doesn't look like a Granite server.";
		case 'outdated':
			return 'This Granite server needs an update to work with the app.';
		case 'invalid':
			return "Enter your server's address, e.g. granite.example.com.";
	}
}
```

Then in `config.ts` append:

```ts
/** Whether a server URL has been chosen on this device (the native app needs one). */
export function hasServerUrl(): boolean {
	try {
		return !!localStorage.getItem(SERVER_KEY);
	} catch {
		return false;
	}
}

export function setServerUrl(url: string): void {
	localStorage.setItem(SERVER_KEY, url);
}

export function clearServerUrl(): void {
	localStorage.removeItem(SERVER_KEY);
}
```

- [ ] **Step 4: Run** — `corepack pnpm exec vitest run src/lib/connect.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/lib/connect.ts apps/mobile/src/lib/connect.test.ts apps/mobile/src/lib/config.ts
git commit -m "feat(mobile): server URL normalisation and Granite server check"
```

### Task 5: `/connect` page, routing, server line on sign-in, change server

**Files:**
- Create: `apps/mobile/src/routes/connect/+page.svelte`
- Create: `apps/mobile/src/lib/components/ServerLine.svelte`
- Modify: `apps/mobile/src/routes/+layout.svelte` (public route + native redirect)
- Modify: `apps/mobile/src/routes/login/+page.svelte`, `apps/mobile/src/routes/register/+page.svelte` (render `<ServerLine />` under the form)
- Modify: `apps/mobile/src/routes/settings/+page.svelte` (native: "Change server" next to the server URL)
- Test: `apps/mobile/src/routes/connect/connect.svelte.test.ts`, `apps/mobile/e2e/connect.spec.ts`

**Interfaces:**
- Consumes: `isNative()` (Task 3); `checkServer`, `connectMessage`, `normalizeServerUrl` (Task 4); `getServerUrl`, `hasServerUrl`, `setServerUrl` (Task 4); `resetLocalData()` from `#lib/sync/index.ts`; `auth.logout()` from `#lib/stores/auth.svelte.ts`.
- Produces: route `/connect` (query `?change=1` keeps the current URL pre-filled); test ids `field-server-url`, `btn-connect`, `connect-error`, `server-line`, `btn-change-server`.

- [ ] **Step 1: Component test (failing)** — `connect.svelte.test.ts`:

```ts
import { render } from '@testing-library/svelte';
import { fireEvent } from '@testing-library/dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { goto, checkServer, resetLocalData } = vi.hoisted(() => ({
	goto: vi.fn(),
	checkServer: vi.fn(),
	resetLocalData: vi.fn(() => Promise.resolve())
}));
vi.mock('$app/navigation', () => ({ goto }));
vi.mock('$app/state', () => ({ page: { url: new URL('http://localhost/connect') } }));
vi.mock('#lib/sync/index.ts', () => ({ resetLocalData }));
vi.mock('#lib/connect.ts', async (orig) => ({ ...(await orig<typeof import('#lib/connect.ts')>()), checkServer }));

import Connect from './+page.svelte';

beforeEach(() => {
	localStorage.clear();
	vi.clearAllMocks();
});

describe('/connect', () => {
	it('saves a valid server and continues to login', async () => {
		checkServer.mockResolvedValue({ ok: true, url: 'https://granite.example.com' });
		const { getByTestId } = render(Connect);
		await fireEvent.input(getByTestId('field-server-url'), { target: { value: 'granite.example.com' } });
		await fireEvent.click(getByTestId('btn-connect'));
		await vi.waitFor(() => expect(goto).toHaveBeenCalledWith('/login'));
		expect(localStorage.getItem('granite.serverUrl')).toBe('https://granite.example.com');
		expect(resetLocalData).not.toHaveBeenCalled(); // first server: nothing to clear
	});

	it('clears local data when switching to a different server', async () => {
		localStorage.setItem('granite.serverUrl', 'https://old.example');
		checkServer.mockResolvedValue({ ok: true, url: 'https://new.example' });
		const { getByTestId } = render(Connect);
		await fireEvent.input(getByTestId('field-server-url'), { target: { value: 'new.example' } });
		await fireEvent.click(getByTestId('btn-connect'));
		await vi.waitFor(() => expect(resetLocalData).toHaveBeenCalled());
		expect(localStorage.getItem('granite.serverUrl')).toBe('https://new.example');
	});

	it.each([
		['unreachable', 'No server answered at down.example. Check the address and your connection.'],
		['not-granite', "That address doesn't look like a Granite server."],
		['outdated', 'This Granite server needs an update to work with the app.']
	])('shows the %s message and stays', async (reason, message) => {
		checkServer.mockResolvedValue({ ok: false, reason });
		const { getByTestId } = render(Connect);
		await fireEvent.input(getByTestId('field-server-url'), { target: { value: 'down.example' } });
		await fireEvent.click(getByTestId('btn-connect'));
		await vi.waitFor(() => expect(getByTestId('connect-error').textContent).toBe(message));
		expect(goto).not.toHaveBeenCalled();
		expect(localStorage.getItem('granite.serverUrl')).toBeNull();
	});
});
```

- [ ] **Step 2: Run** — `corepack pnpm exec vitest run src/routes/connect` → FAIL.

- [ ] **Step 3: Implement the page** — `routes/connect/+page.svelte` (mirrors the login page's layout and classes):

```svelte
<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { checkServer, connectMessage } from '#lib/connect.ts';
	import { getServerUrl, hasServerUrl, setServerUrl } from '#lib/config.ts';
	import { resetLocalData } from '#lib/sync/index.ts';
	import Button from '#lib/components/ui/Button.svelte';
	import favicon from '#lib/assets/favicon.svg';

	// Native only: the app isn't served by a Granite server, so it asks for one once.
	const previous = hasServerUrl() ? getServerUrl() : null;
	let address = $state(page.url.searchParams.get('change') && previous ? previous : '');
	let error = $state('');
	let busy = $state(false);

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		busy = true;
		error = '';
		const result = await checkServer(address);
		busy = false;
		if (!result.ok) {
			error = connectMessage(result.reason, address);
			return;
		}
		// A different server's data must never mix with this one's.
		if (previous && previous !== result.url) await resetLocalData();
		setServerUrl(result.url);
		await goto('/login');
	}
</script>

<svelte:head><title>Connect · Granite</title></svelte:head>

<main class="auth">
	<div class="brand"><img class="logo" src={favicon} alt="" />Granite</div>
	<form class="card" onsubmit={submit}>
		<h2>Connect to your server</h2>
		<p class="muted lead">Enter the address of your Granite server.</p>
		<label for="server">Server address</label>
		<input
			id="server"
			type="url"
			inputmode="url"
			autocapitalize="none"
			autocomplete="url"
			placeholder="granite.example.com"
			bind:value={address}
			required
			data-testid="field-server-url"
		/>
		{#if error}<p class="error" data-testid="connect-error">{error}</p>{/if}
		<div class="submit">
			<Button type="submit" block disabled={busy} testid="btn-connect">
				{busy ? 'Checking…' : 'Connect'}
			</Button>
		</div>
	</form>
</main>

<style>
	.auth {
		max-width: 22rem;
		margin: 0 auto;
		padding: 4rem 1rem 2rem;
	}
	.brand {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		font-weight: 600;
		font-size: 1.15rem;
		margin-bottom: 1.25rem;
	}
	.logo {
		width: 28px;
		height: 28px;
		display: block;
	}
	.card h2 {
		margin: 0 0 0.25rem;
		font-size: 1.1rem;
		font-weight: 600;
		text-align: center;
	}
	.lead {
		margin: 0 0 1rem;
		text-align: center;
		font-size: 0.9rem;
	}
	.submit {
		margin-top: 1rem;
	}
</style>
```

(Match `.submit` / `.error` spacing to `routes/login/+page.svelte`'s styles if they differ.)

- [ ] **Step 4: Server line component** — `lib/components/ServerLine.svelte`:

```svelte
<script lang="ts">
	import { getServerUrl } from '#lib/config.ts';
	import { isNative } from '#lib/platform/native.ts';

	// Under the sign-in forms in the native app: which server you're signing in to.
	const host = (() => {
		try {
			return new URL(getServerUrl()).host;
		} catch {
			return getServerUrl();
		}
	})();
</script>

{#if isNative()}
	<p class="muted server" data-testid="server-line">
		Server: {host} · <a href="/connect?change=1" data-testid="btn-change-server">Change</a>
	</p>
{/if}

<style>
	.server {
		text-align: center;
		font-size: 0.85rem;
		margin-top: 0.5rem;
	}
</style>
```

Render `<ServerLine />` directly after the `<p class="muted alt">…</p>` line in both `routes/login/+page.svelte` and `routes/register/+page.svelte` (import it with `import ServerLine from '#lib/components/ServerLine.svelte';`).

- [ ] **Step 5: Routing** — in `routes/+layout.svelte`:
  - add imports `import { isNative } from '#lib/platform/native.ts';` and `import { hasServerUrl } from '#lib/config.ts';`
  - change `const publicRoutes = ['/login', '/register'];` to `const publicRoutes = ['/login', '/register', '/connect'];`
  - replace the redirect `$effect` body with:

```ts
	$effect(() => {
		if (!auth.ready) return;
		const path = page.url.pathname;
		// The native app needs a server before anything else.
		if (isNative() && !hasServerUrl()) {
			if (path !== '/connect') void goto('/connect');
			return;
		}
		const isPublic = publicRoutes.includes(path);
		if (!auth.isAuthenticated && !isPublic) void goto('/login');
		if (auth.isAuthenticated && isPublic && path !== '/connect') void goto('/');
	});
```

- [ ] **Step 6: Settings "Change server" (native)** — in `routes/settings/+page.svelte`, next to `<span class="mono">{getServerUrl()}</span>` add (import `isNative` and `goto` if not imported; `auth` is already used on that page for logout):

```svelte
{#if isNative()}
	<Button variant="outline" size="sm" onclick={changeServer} testid="btn-settings-change-server">Change server</Button>
{/if}
```

with, in the script:

```ts
	// Switching servers signs out and clears local data (logout already wipes it).
	async function changeServer() {
		if (!confirm('Change server? You will be signed out and this device’s local data cleared.')) return;
		await auth.logout();
		await goto('/connect?change=1');
	}
```

- [ ] **Step 7: Unit tests pass** — `corepack pnpm exec vitest run src/routes/connect src/lib` → PASS; `corepack pnpm check` → 0 errors.

- [ ] **Step 8: e2e** — `e2e/connect.spec.ts`:

```ts
import { expect, test } from '@playwright/test';
import { PASSWORD } from './helpers';

// The e2e build honours granite.forceNative, so the web build behaves like the app.
test('native: connect → register → change server clears local data', async ({ page, baseURL }) => {
	await page.addInitScript(() => localStorage.setItem('granite.forceNative', '1'));
	await page.goto('/');
	await expect(page).toHaveURL(/\/connect$/);

	// Wrong address first: plain-language error, stays on /connect.
	await page.getByTestId('field-server-url').fill('http://127.0.0.1:9');
	await page.getByTestId('btn-connect').click();
	await expect(page.getByTestId('connect-error')).toContainText('No server answered');

	// The e2e server itself is a current Granite server.
	await page.getByTestId('field-server-url').fill(baseURL!);
	await page.getByTestId('btn-connect').click();
	await expect(page).toHaveURL(/\/login$/);
	await expect(page.getByTestId('server-line')).toContainText(new URL(baseURL!).host);

	// Register (logout on server change then wipes this device's local data).
	await page.goto('/register');
	await page.getByTestId('field-email').fill(`native_${Date.now()}@test.local`);
	await page.getByTestId('field-password').fill(PASSWORD);
	await page.getByTestId('btn-register').click();
	await expect(page.getByTestId('btn-start-workout')).toBeVisible();

	// Change server from Settings: signs out and returns to /connect, prefilled.
	await page.goto('/settings');
	page.once('dialog', (d) => d.accept());
	await page.getByTestId('btn-settings-change-server').click();
	await expect(page).toHaveURL(/\/connect\?change=1$/);
	await expect(page.getByTestId('field-server-url')).toHaveValue(baseURL!);
});

test('web: no connect step, no server line', async ({ page }) => {
	await page.goto('/login');
	await expect(page).toHaveURL(/\/login$/);
	await expect(page.getByTestId('server-line')).toHaveCount(0);
});
```

Run (bash, `apps/mobile`, Go/node on PATH, `GO_BIN` set, distinct `E2E_PORT`): `corepack pnpm exec playwright test e2e/connect.spec.ts e2e/auth.spec.ts` → PASS. Then the full suite → 42+ passed. Revert `apps/api/internal/webui/dist/index.html`.

- [ ] **Step 9: Screenshot `/connect` for the user** (local Playwright screenshots config, temp spec, not committed) and include it in the PR report.

- [ ] **Step 10: Commit, PR, merge on green**

```bash
git add apps/mobile/src/routes/connect apps/mobile/src/lib/components/ServerLine.svelte apps/mobile/src/routes/+layout.svelte apps/mobile/src/routes/login/+page.svelte apps/mobile/src/routes/register/+page.svelte apps/mobile/src/routes/settings/+page.svelte apps/mobile/e2e/connect.spec.ts
git commit -m "feat(mobile): connect-to-your-server step for the native app"
git push -u origin feat/native-connect && gh pr create --title "feat(mobile): platform seam + connect-to-your-server step" --body "<summary, screenshots, tests>"
```

---

## PR 3 — Capacitor Android scaffold + native features + debug APK CI

Branch `feat/capacitor-android` from updated `main`.

### Task 6: Capacitor project

**Files:**
- Create: `apps/mobile/capacitor.config.ts`
- Create: `apps/mobile/android/**` (generated by `cap add android`)
- Modify: `apps/mobile/package.json` (devDeps `@capacitor/cli`, deps `@capacitor/android`, scripts `cap:sync`)
- Modify: `apps/mobile/android/app/build.gradle` (version from env), `apps/mobile/android/app/src/main/AndroidManifest.xml` (cleartext)
- Modify: `.gitignore` / `apps/mobile/android/.gitignore` (keep build outputs out)

- [ ] **Step 1: Install**

```bash
cd apps/mobile
corepack pnpm add @capacitor/android@^8.5.3 @capacitor/local-notifications@^8.3.1 @capacitor-community/keep-awake@^8.0.1
corepack pnpm add -D @capacitor/cli@^8.5.3
```

- [ ] **Step 2: Config** — `capacitor.config.ts`:

```ts
import type { CapacitorConfig } from '@capacitor/cli';

// The native shell around the same static build the Go binary embeds.
const config: CapacitorConfig = {
	appId: 'io.github.morrismorrison.granite',
	appName: 'Granite',
	webDir: 'build',
	android: {
		// The app runs on https://localhost; self-hosted servers on plain http (LAN)
		// would otherwise be blocked as mixed content.
		allowMixedContent: true
	},
	server: { androidScheme: 'https', cleartext: true },
	plugins: {
		LocalNotifications: { smallIcon: 'ic_stat_granite', iconColor: '#2563eb' }
	}
};

export default config;
```

Add script `"cap:sync": "vite build && cap sync android"` to `package.json`.

- [ ] **Step 3: Generate the Android project** (needs no Android SDK; Gradle runs only in CI)

```bash
corepack pnpm build && corepack pnpm exec cap add android && corepack pnpm exec cap sync android
git status --short apps/mobile/android | head
```

Ensure `apps/mobile/android/.gitignore` (generated) ignores `build/`, `.gradle/`, `local.properties`, `app/src/main/assets/public` and `capacitor-cordova-android-plugins` — add any missing line.

- [ ] **Step 4: Version from env** — in `android/app/build.gradle` inside `defaultConfig { ... }` replace the generated `versionCode`/`versionName` lines with:

```gradle
        // CI sets these from the tag (v1.2.3 -> 1.2.3 / 10203); local builds get 0.0.0.
        versionName System.getenv("GRANITE_VERSION_NAME") ?: "0.0.0"
        versionCode (System.getenv("GRANITE_VERSION_CODE") ?: "1").toInteger()
```

- [ ] **Step 5: Manifest** — in `android/app/src/main/AndroidManifest.xml` add `android:usesCleartextTraffic="true"` to `<application>` and, inside `<manifest>`:

```xml
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
    <uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM" />
    <uses-permission android:name="android.permission.WAKE_LOCK" />
```

- [ ] **Step 6: Notification icon** — add a monochrome `android/app/src/main/res/drawable/ic_stat_granite.xml` vector (the barbell glyph from `src/lib/assets/favicon.svg`, white fill, 24dp):

```xml
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="24dp" android:height="24dp" android:viewportWidth="24" android:viewportHeight="24">
    <path android:fillColor="#FFFFFFFF"
        android:pathData="M2,11h1V8h2v8H3v-3H2zM6,6h2v12H6zM16,6h2v12h-2zM19,8h2v3h1v2h-1v3h-2zM9,11h6v2H9z" />
</vector>
```

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/capacitor.config.ts apps/mobile/android apps/mobile/package.json pnpm-lock.yaml
git commit -m "feat(mobile): Capacitor Android project"
```

### Task 7: Native rest notification + keep-awake

**Files:**
- Modify: `apps/mobile/src/lib/platform/native.ts` (plugin bodies)
- Modify: `apps/mobile/src/lib/platform/native.test.ts` (device-path tests)
- Modify: `apps/mobile/src/lib/restTimer.ts` (+ `endsAt()`), `apps/mobile/src/lib/restTimer.test.ts`
- Modify: `apps/mobile/src/routes/log/+page.svelte` (call the seam)

**Interfaces:**
- Consumes: Task 3 seam signatures.
- Produces: `RestTimer.endsAt(): number | null` (epoch ms while running, else null). Notification id constant `REST_NOTIFICATION_ID = 1`.

- [ ] **Step 1: Failing tests** — append to `restTimer.test.ts`:

```ts
describe('endsAt', () => {
	it('is the absolute end while running and null otherwise', () => {
		vi.useFakeTimers();
		vi.setSystemTime(1_000_000);
		const t = createRestTimer();
		expect(t.endsAt()).toBeNull();
		t.start(90);
		expect(t.endsAt()).toBe(1_000_000 + 90_000);
		t.bump(15);
		expect(t.endsAt()).toBe(1_000_000 + 105_000);
		t.stop();
		expect(t.endsAt()).toBeNull();
		vi.useRealTimers();
	});
});
```

(add `vi` to the file's vitest import if missing) and to `native.test.ts`:

```ts
const { schedule, cancel, checkPermissions, requestPermissions, keepAwakeOn, allowSleep } = vi.hoisted(() => ({
	schedule: vi.fn(() => Promise.resolve()),
	cancel: vi.fn(() => Promise.resolve()),
	checkPermissions: vi.fn(() => Promise.resolve({ display: 'prompt' })),
	requestPermissions: vi.fn(() => Promise.resolve({ display: 'granted' })),
	keepAwakeOn: vi.fn(() => Promise.resolve()),
	allowSleep: vi.fn(() => Promise.resolve())
}));
vi.mock('@capacitor/local-notifications', () => ({
	LocalNotifications: { schedule, cancel, checkPermissions, requestPermissions }
}));
vi.mock('@capacitor-community/keep-awake', () => ({ KeepAwake: { keepAwake: keepAwakeOn, allowSleep } }));

describe('platform seam on a device', () => {
	beforeEach(() => vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true));
	afterEach(() => vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false));

	it('asks for permission once, then schedules the rest notification at the end time', async () => {
		await scheduleRestEnd(5_000);
		expect(requestPermissions).toHaveBeenCalledTimes(1);
		expect(cancel).toHaveBeenCalledWith({ notifications: [{ id: 1 }] });
		expect(schedule).toHaveBeenCalledWith({
			notifications: [
				expect.objectContaining({ id: 1, title: 'Rest over', body: 'Time for your next set.', schedule: { at: new Date(5_000), allowWhileIdle: true } })
			]
		});
	});

	it('does not schedule when permission is denied', async () => {
		checkPermissions.mockResolvedValueOnce({ display: 'denied' });
		schedule.mockClear();
		await scheduleRestEnd(5_000);
		expect(schedule).not.toHaveBeenCalled();
	});

	it('cancels and toggles keep-awake', async () => {
		await cancelRestEnd();
		expect(cancel).toHaveBeenCalledWith({ notifications: [{ id: 1 }] });
		await keepAwake(true);
		expect(keepAwakeOn).toHaveBeenCalled();
		await keepAwake(false);
		expect(allowSleep).toHaveBeenCalled();
	});
});
```

(add `beforeEach` to that file's vitest import.)

- [ ] **Step 2: Run** — `corepack pnpm exec vitest run src/lib/platform src/lib/restTimer.test.ts` → FAIL.

- [ ] **Step 3: Implement** — `restTimer.ts`: add to the `RestTimer` interface

```ts
	/** Absolute end (epoch ms) while running, else null — for scheduling a native alert. */
	endsAt(): number | null;
```

and to the returned object `endsAt: () => (running ? endsAt : null),`.

Replace the three no-op bodies in `native.ts`:

```ts
const REST_NOTIFICATION_ID = 1;

/** Schedule the "rest over" notification at epoch-ms `at` (replaces a pending one). */
export async function scheduleRestEnd(at: number): Promise<void> {
	if (!device()) return;
	const { LocalNotifications } = await import('@capacitor/local-notifications');
	let { display } = await LocalNotifications.checkPermissions();
	if (display === 'prompt' || display === 'prompt-with-rationale') {
		({ display } = await LocalNotifications.requestPermissions());
	}
	if (display !== 'granted') return; // the in-app alert still fires while open
	await LocalNotifications.cancel({ notifications: [{ id: REST_NOTIFICATION_ID }] });
	await LocalNotifications.schedule({
		notifications: [
			{
				id: REST_NOTIFICATION_ID,
				title: 'Rest over',
				body: 'Time for your next set.',
				schedule: { at: new Date(at), allowWhileIdle: true }
			}
		]
	});
}

/** Cancel a pending rest notification. */
export async function cancelRestEnd(): Promise<void> {
	if (!device()) return;
	const { LocalNotifications } = await import('@capacitor/local-notifications');
	await LocalNotifications.cancel({ notifications: [{ id: REST_NOTIFICATION_ID }] });
}

/** Keep the screen on (logger open) or let it sleep again. */
export async function keepAwake(on: boolean): Promise<void> {
	if (!device()) return;
	const { KeepAwake } = await import('@capacitor-community/keep-awake');
	await (on ? KeepAwake.keepAwake() : KeepAwake.allowSleep());
}
```

(The "asks for permission once" test relies on `checkPermissions` returning `prompt` only the first time in real use; in the test, `requestPermissions` is called once per `scheduleRestEnd` call — the assertion is per call, which matches.)

- [ ] **Step 4: Wire the logger** — in `routes/log/+page.svelte` import `import { cancelRestEnd, keepAwake, scheduleRestEnd } from '#lib/platform/native.ts';` and change:

```ts
	function startRest(seconds: number) {
		timer.start(seconds);
		if (!restInterval) restInterval = setInterval(refresh, 1000);
		sync();
		void scheduleRestEnd(timer.endsAt()!);
	}
	function bumpRest(delta: number) {
		timer.bump(delta);
		sync();
		const at = timer.endsAt();
		if (at) void scheduleRestEnd(at);
	}
	function stopRest() {
		timer.stop();
		if (restInterval) {
			clearInterval(restInterval);
			restInterval = null;
		}
		sync();
		void cancelRestEnd();
	}
```

and in the existing `onMount`/`onDestroy` pair:

```ts
	onMount(() => {
		document.addEventListener('visibilitychange', onVisible);
		void keepAwake(true);
	});
	onDestroy(() => {
		document.removeEventListener('visibilitychange', onVisible);
		stopRest();
		void keepAwake(false);
	});
```

(`finish()` navigates away → `onDestroy` releases keep-awake and cancels the notification via `stopRest()`.)

- [ ] **Step 5: Run** — `corepack pnpm exec vitest run` → all PASS; `corepack pnpm check` → 0 errors; `corepack pnpm exec playwright test e2e/workout.spec.ts e2e/workout-extra.spec.ts` → PASS (web path unchanged).

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/lib/platform apps/mobile/src/lib/restTimer.ts apps/mobile/src/lib/restTimer.test.ts apps/mobile/src/routes/log/+page.svelte
git commit -m "feat(mobile): native rest-over notification and keep-awake in the logger"
```

### Task 8: Debug APK CI job

**Files:**
- Create: `.github/workflows/android.yml`

- [ ] **Step 1: Workflow**

```yaml
name: Android

on:
  pull_request:
    paths: ['apps/mobile/**', 'packages/shared/**', 'pnpm-lock.yaml', '.github/workflows/android.yml']
  push:
    branches: [main]
    paths: ['apps/mobile/**', 'packages/shared/**', 'pnpm-lock.yaml', '.github/workflows/android.yml']

concurrency:
  group: android-${{ github.ref }}
  cancel-in-progress: true

jobs:
  debug-apk:
    name: Android debug APK
    runs-on: ubuntu-latest   # PUBLIC repo → GitHub-hosted only
    timeout-minutes: 25
    steps:
      - uses: actions/checkout@v7
      - run: corepack enable
      - uses: actions/setup-node@v7
        with:
          node-version: '24'
          cache: pnpm
      - uses: actions/setup-java@v5
        with:
          distribution: temurin
          java-version: '21'
          cache: gradle
      - uses: android-actions/setup-android@v3
      - run: corepack pnpm install --frozen-lockfile
      - name: Build web + sync into the Android project
        run: corepack pnpm --filter mobile run cap:sync
      - name: Assemble debug APK
        working-directory: apps/mobile/android
        run: ./gradlew assembleDebug --no-daemon
      - uses: actions/upload-artifact@v7
        with:
          name: granite-debug-apk
          path: apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk
          retention-days: 14
```

(Match the action major versions already used in `.github/workflows/ci.yml`; check `actions/setup-java` / `android-actions/setup-android` latest majors before committing.)

- [ ] **Step 2: Make gradlew executable in git** — `git update-index --chmod=+x apps/mobile/android/gradlew`; add `apps/mobile/android/gradlew text eol=lf` to `.gitattributes`.

- [ ] **Step 3: Commit, push, PR** — the PR's own CI runs the job; confirm the artifact is produced, then squash-merge on green.

```bash
git add .github/workflows/android.yml .gitattributes apps/mobile/android/gradlew
git commit -m "ci: build an Android debug APK on PRs"
git push -u origin feat/capacitor-android && gh pr create --title "feat(mobile): Capacitor Android app (rest notification, keep-awake) + debug APK CI" --body "<summary, how to install the artifact, tests>"
```

- [ ] **Step 4: Manual smoke (user's phone)** — download `granite-debug-apk` from the PR run, install, connect to the test instance, log a set, lock the phone during rest → notification fires; screen stays on in the logger. Record the result in the PR.

---

## PR 4 — Signed release APK on tags + docs

Branch `feat/android-release` from updated `main`. **Blocked on the keystore secrets.**

### Task 9: Keystore (user) + signing config

- [ ] **Step 1: User generates the keystore once** (on any machine with a JDK; keep the file and passwords backed up outside the repo):

```bash
keytool -genkeypair -v -keystore granite-release.jks -alias granite -keyalg RSA -keysize 4096 -validity 10000
base64 -w0 granite-release.jks > granite-release.jks.b64
gh secret set ANDROID_KEYSTORE_BASE64 -R MorrisMorrison/granite < granite-release.jks.b64
gh secret set ANDROID_KEYSTORE_PASSWORD -R MorrisMorrison/granite
gh secret set ANDROID_KEY_ALIAS -R MorrisMorrison/granite --body granite
gh secret set ANDROID_KEY_PASSWORD -R MorrisMorrison/granite
```

- [ ] **Step 2: Signing config** — in `android/app/build.gradle`, inside `android { ... }` before `buildTypes`:

```gradle
    signingConfigs {
        release {
            // CI decodes the keystore to this path; absent locally → unsigned release build.
            def ks = System.getenv("GRANITE_KEYSTORE_FILE")
            if (ks) {
                storeFile file(ks)
                storePassword System.getenv("ANDROID_KEYSTORE_PASSWORD")
                keyAlias System.getenv("ANDROID_KEY_ALIAS")
                keyPassword System.getenv("ANDROID_KEY_PASSWORD")
            }
        }
    }
```

and in `buildTypes { release { ... } }` add `signingConfig signingConfigs.release`.

### Task 10: Release workflow

**Files:**
- Modify: `.github/workflows/android.yml` (add a `release-apk` job on tags)

- [ ] **Step 1: Add trigger + job** — add `tags: ['v*']` under `push:` (keep the `paths` filter only on the branch push by splitting: `push: { branches: [main], paths: [...] }` stays; add a separate top-level `push` is not allowed, so use `on.push.tags` alongside `branches` and guard jobs with `if:`). Final `on:` block:

```yaml
on:
  pull_request:
    paths: ['apps/mobile/**', 'packages/shared/**', 'pnpm-lock.yaml', '.github/workflows/android.yml']
  push:
    branches: [main]
    tags: ['v*']
```

Guard `debug-apk` with `if: github.ref_type != 'tag'` and add:

```yaml
  release-apk:
    name: Signed release APK
    if: github.ref_type == 'tag'
    runs-on: ubuntu-latest
    timeout-minutes: 25
    permissions:
      contents: write   # create the GitHub Release
    steps:
      - uses: actions/checkout@v7
      - run: corepack enable
      - uses: actions/setup-node@v7
        with:
          node-version: '24'
          cache: pnpm
      - uses: actions/setup-java@v5
        with:
          distribution: temurin
          java-version: '21'
          cache: gradle
      - uses: android-actions/setup-android@v3
      - run: corepack pnpm install --frozen-lockfile
      - name: Version from tag
        run: |
          v="${GITHUB_REF_NAME#v}"
          IFS=. read -r major minor patch <<< "$v"
          echo "GRANITE_VERSION_NAME=$v" >> "$GITHUB_ENV"
          echo "GRANITE_VERSION_CODE=$(( major*10000 + minor*100 + patch ))" >> "$GITHUB_ENV"
      - name: Decode keystore
        env:
          ANDROID_KEYSTORE_BASE64: ${{ secrets.ANDROID_KEYSTORE_BASE64 }}
        run: |
          echo "$ANDROID_KEYSTORE_BASE64" | base64 -d > "$RUNNER_TEMP/release.jks"
          echo "GRANITE_KEYSTORE_FILE=$RUNNER_TEMP/release.jks" >> "$GITHUB_ENV"
      - run: corepack pnpm --filter mobile run cap:sync
      - name: Assemble signed release APK
        working-directory: apps/mobile/android
        env:
          ANDROID_KEYSTORE_PASSWORD: ${{ secrets.ANDROID_KEYSTORE_PASSWORD }}
          ANDROID_KEY_ALIAS: ${{ secrets.ANDROID_KEY_ALIAS }}
          ANDROID_KEY_PASSWORD: ${{ secrets.ANDROID_KEY_PASSWORD }}
        run: ./gradlew assembleRelease --no-daemon
      - name: Publish to the GitHub Release
        env:
          GH_TOKEN: ${{ github.token }}
        run: |
          apk="granite-${GRANITE_VERSION_NAME}.apk"
          cp apps/mobile/android/app/build/outputs/apk/release/app-release.apk "$apk"
          gh release view "$GITHUB_REF_NAME" >/dev/null 2>&1 || gh release create "$GITHUB_REF_NAME" --generate-notes --title "Granite $GRANITE_VERSION_NAME"
          gh release upload "$GITHUB_REF_NAME" "$apk" --clobber
```

- [ ] **Step 2: Verify locally what can be verified** — `node -e` YAML parse of the workflow; no local Gradle.

### Task 11: Docs

**Files:**
- Create: `docs/decisions/0012-android-app-capacitor.md`; Modify: `docs/decisions/README.md` (index row)
- Modify: `docs/06-mobile-app.md` (status: Android shipped; IndexedDB kept; connect step; CORS origins), `docs/07-self-hosting.md` (the app works with any current server; HTTP LAN servers supported), `README.md` (Android download link: Releases)

- [ ] **Step 1: ADR-0012** — context (PWA limits on locked-screen alerts), decision (Android via Capacitor 8; IndexedDB kept; native origins always in CORS; `/api/v1/info` with `api_version`; signed APK on GitHub Releases), consequences (iOS later on macOS CI; keystore must never change; bump `api_version` when the app needs newer server behaviour).
- [ ] **Step 2:** update the three docs + README as listed. Scrub for personal infrastructure terms before committing.
- [ ] **Step 3: Commit, PR, merge on green; then tag the first release** (`git tag v0.1.0 && git push origin v0.1.0` — confirm the version with the user first) and verify the APK lands on the Release and installs over the debug build's absence (fresh install).

---

## Self-review notes

- Spec coverage: CORS origins (T1), `/api/v1/info` (T2), seam (T3/T7), connect + errors + change server + data clearing (T4/T5), keep-awake + rest notification (T7), debug CI (T8), signing + release + versioning (T9/T10), docs + ADR (T11), tests at each layer (unit, component, e2e, Go), manual smoke (T8 step 4).
- Mixed-content/cleartext handling for LAN servers (T6) is an implementation detail the spec implies ("any self-hosted server").
