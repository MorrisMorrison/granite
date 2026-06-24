import { expect, test } from '@playwright/test';
import { logWorkout, register } from './helpers';

test('home shows training stats after logging a workout', async ({ page }) => {
	await register(page);
	await logWorkout(page);

	await page.goto('/');
	await expect(page.getByTestId('home-stats')).toBeVisible();
	await expect(page.getByTestId('stat-total')).toHaveText('1');
	await expect(page.getByTestId('stat-this-week')).toHaveText('1');
	await expect(page.getByTestId('stat-streak')).toHaveText('1');
	await expect(page.getByText(/Last workout: today/)).toBeVisible();
});
