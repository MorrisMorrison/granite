import { expect, test } from '@playwright/test';
import { logWorkout, register } from './helpers';

test('stats shows sets-per-muscle and weekly volume after a workout', async ({ page }) => {
	await register(page);
	await logWorkout(page); // one working set logged today

	await page.goto('/');
	await page.getByTestId('nav-tab-stats').click();
	await expect(page).toHaveURL(/\/stats$/);

	await expect(page.getByTestId('muscle-bars')).toBeVisible();
	await expect(page.getByText(/This week:/)).toBeVisible();
	// A single logged working set already yields an all-time record.
	await expect(page.getByTestId('records-list')).toBeVisible();
	await expect(page.getByTestId('record-row').first()).toBeVisible();
});

test('stats time-range control switches the muscle-balance window', async ({ page }) => {
	await register(page);
	await logWorkout(page);

	await page.goto('/stats');
	// Default window is 8 weeks.
	await expect(page.getByText(/Sets per muscle · last 8 weeks/)).toBeVisible();
	await expect(page.getByTestId('range-8w')).toHaveClass(/active/);

	await page.getByTestId('range-12w').click();
	await expect(page.getByText(/Sets per muscle · last 12 weeks/)).toBeVisible();
	await expect(page.getByTestId('muscle-bars')).toBeVisible();
});

test('stats top-lifts shows a trend after repeated sessions of a lift', async ({ page }) => {
	await register(page);
	await logWorkout(page); // session 1 of the first-library lift (ends on /history)
	await page.goto('/'); // logWorkout starts from Today
	await logWorkout(page); // session 2 → a two-point e1RM trend

	await page.goto('/stats');
	await expect(page.getByTestId('top-lifts')).toBeVisible();
	await expect(page.getByTestId('top-lift-row').first()).toBeVisible();
});
