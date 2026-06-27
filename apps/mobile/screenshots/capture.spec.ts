import { test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

// Output dir at the repo root: docs/screenshots/ (cwd is apps/mobile when run via
// `pnpm --filter mobile screenshots`).
const OUT = resolve(process.cwd(), '../../docs/screenshots');

// Seeded demo account (server runs with GRANITE_ENV=dev — see the screenshots config).
const DEMO_EMAIL = 'demo@granite.local';
const DEMO_PASSWORD = 'demodata';

const screens = [
	{ name: 'today', path: '/' },
	{ name: 'routines', path: '/routines' },
	{ name: 'history', path: '/history' },
	{ name: 'insights', path: '/insights' },
	{ name: 'exercises', path: '/exercises' }
];

test('capture README screenshots', async ({ page }) => {
	mkdirSync(OUT, { recursive: true });

	// Log in as the demo account (rich demo data → populated screens).
	await page.goto('/login');
	await page.getByTestId('field-email').fill(DEMO_EMAIL);
	await page.getByTestId('field-password').fill(DEMO_PASSWORD);
	await page.getByTestId('btn-login').click();
	await page.getByTestId('btn-start-workout').waitFor({ state: 'visible' });

	for (const s of screens) {
		await page.goto(s.path);
		// Let the route render + any charts/animations settle before capturing.
		await page.waitForLoadState('load');
		await page.waitForTimeout(700);
		await page.screenshot({ path: `${OUT}/${s.name}.png` });
	}
});
