import { defineConfig, devices } from '@playwright/test';

const PORT = process.env.E2E_PORT ?? '4321';
const BASE = `http://localhost:${PORT}`;

export default defineConfig({
	testDir: './e2e',
	// One shared backend + SQLite file, so keep it serial and deterministic.
	fullyParallel: false,
	workers: 1,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	reporter: process.env.CI
		? [['list'], ['html', { open: 'never' }], ['junit', { outputFile: 'junit.xml' }]]
		: 'list',
	// The suite drives a real Go binary + SQLite on a shared, lane-contended CI
	// runner, so first paint / bootstrap can occasionally run long. Give assertions
	// generous headroom (and more CI retries) so contention doesn't fail real work.
	expect: { timeout: 20_000 },
	use: {
		baseURL: BASE,
		// Offline behaviour is exercised via context.setOffline (no offline page
		// reloads), so the service worker stays blocked to keep caching deterministic.
		serviceWorkers: 'block',
		trace: 'on-first-retry'
	},
	projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
	webServer: {
		command: 'node e2e/serve.mjs',
		url: `${BASE}/healthz`,
		reuseExistingServer: !process.env.CI,
		timeout: 180_000,
		stdout: 'pipe',
		stderr: 'pipe'
	}
});
