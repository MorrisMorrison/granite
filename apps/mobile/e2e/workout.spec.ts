import { expect, test } from '@playwright/test';
import { register } from './helpers';

test('log a workout and see it in history', async ({ page }) => {
	await register(page);

	await page.getByTestId('btn-start-workout').click();
	await expect(page).toHaveURL(/\/log$/);

	// The picker opens automatically on a fresh workout; add the first exercise.
	await page.getByTestId('picker-exercise').first().click();

	await expect(page.getByTestId('set-row')).toBeVisible();
	await page.getByTestId('input-weight').fill('60');
	await page.getByTestId('input-reps').fill('5');
	await page.getByTestId('set-complete').check();

	await page.getByTestId('btn-finish-workout').click();

	await expect(page).toHaveURL(/\/history$/);
	await expect(page.getByTestId('workout-row')).toHaveCount(1);
});
