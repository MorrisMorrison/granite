import { defineConfig, devices } from '@playwright/test';

// Generates the README screenshots: boots the real binary with demo data
// (GRANITE_ENV=dev seeds demo@granite.local), logs in, and captures key screens
// at a phone viewport. Run via `pnpm --filter mobile screenshots`; CI commits the
// results back on main. Separate from the e2e config so the two never interfere.
const PORT = process.env.E2E_PORT ?? '4322';
const BASE = `http://localhost:${PORT}`;

export default defineConfig({
	testDir: './screenshots',
	fullyParallel: false,
	workers: 1,
	retries: process.env.CI ? 1 : 0,
	reporter: 'list',
	use: {
		baseURL: BASE,
		serviceWorkers: 'block'
	},
	// Pixel 5 is a chromium device descriptor (mobile viewport + scale), so it works
	// with the chromium browser the CI already installs.
	projects: [{ name: 'mobile', use: { ...devices['Pixel 5'] } }],
	webServer: {
		command: 'node e2e/serve.mjs',
		url: `${BASE}/healthz`,
		reuseExistingServer: !process.env.CI,
		timeout: 180_000,
		env: { E2E_PORT: PORT, GRANITE_ENV: 'dev' },
		stdout: 'pipe',
		stderr: 'pipe'
	}
});
