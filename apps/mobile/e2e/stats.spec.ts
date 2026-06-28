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
});
