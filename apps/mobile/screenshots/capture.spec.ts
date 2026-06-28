import { test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

// Output dir at the repo root: docs/screenshots/ (cwd is apps/mobile when run via
// `pnpm --filter mobile screenshots`). CI publishes these to the `screenshots` branch.
const OUT = resolve(process.cwd(), '../../docs/screenshots');

// Seeded demo account (server runs with GRANITE_ENV=dev — see the screenshots config).
const DEMO_EMAIL = 'demo@granite.local';
const DEMO_PASSWORD = 'demodata';

async function shot(page: Page, name: string) {
	await page.waitForTimeout(700); // let the route + any charts/animations settle
	await page.screenshot({ path: `${OUT}/${name}.png` });
}

test('capture README screenshots', async ({ page }) => {
	mkdirSync(OUT, { recursive: true });

	// Log in as the demo account (rich demo data → populated screens).
	await page.goto('/login');
	await page.getByTestId('field-email').fill(DEMO_EMAIL);
	await page.getByTestId('field-password').fill(DEMO_PASSWORD);
	await page.getByTestId('btn-login').click();
	await page.getByTestId('btn-start-workout').waitFor({ state: 'visible' });

	// Top-level tabs.
	await page.goto('/');
	await shot(page, 'today');
	await page.goto('/routines');
	await shot(page, 'routines');
	await page.goto('/history');
	await shot(page, 'history');
	await page.goto('/stats');
	await shot(page, 'stats');

	// Exercise detail — progress chart + PRs + estimated 1RM, for a demo exercise
	// that has logged history.
	await page.goto('/exercises');
	await page.getByTestId('field-exercise-search').fill('Barbell Back Squat');
	await page.getByTestId('exercise-row').first().click();
	await page.getByTestId('pr-1rm').waitFor({ state: 'visible' });
	await shot(page, 'exercise-detail');

	// Workout log — start a routine and complete a couple of sets so the rest timer
	// is on screen. Grab the first routine id via the API (same origin, demo token).
	const routineId = await page.evaluate(async () => {
		const token = localStorage.getItem('granite.access');
		const res = await fetch('/api/v1/routines', { headers: { Authorization: `Bearer ${token}` } });
		const body = await res.json();
		return body.routines?.[0]?.id ?? null;
	});
	await page.goto(`/log?routine=${routineId}`);
	const completes = page.getByTestId('set-complete');
	await completes.first().waitFor({ state: 'visible' });
	const n = await completes.count();
	await completes.nth(0).check();
	if (n > 1) await completes.nth(1).check(); // a second set → "a few" checked + rest timer running
	await shot(page, 'workout-log');
});
