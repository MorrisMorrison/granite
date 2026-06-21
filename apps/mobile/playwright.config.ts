import { defineConfig, devices } from '@playwright/test';

const PORT = process.env.E2E_PORT ?? '4321';
const BASE = `http://localhost:${PORT}`;

export default defineConfig({
	testDir: './e2e',
	// One shared backend + SQLite file, so keep it serial and deterministic.
	fullyParallel: false,
	workers: 1,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
	use: {
		baseURL: BASE,
		// We're not testing offline here; block the SW so caching can't make runs flaky.
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
