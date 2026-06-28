import { expect, test } from '@playwright/test';
import { register } from './helpers';

test('create a custom exercise from the library', async ({ page }) => {
	await register(page);
	await page.goto('/exercises');

	await page.getByTestId('btn-new-exercise').click();
	await expect(page).toHaveURL(/\/exercises\/new$/);

	await page.getByTestId('field-exercise-name').fill('My Cable Fly');
	await page.getByTestId('field-exercise-muscle').fill('Chest');
	await page.getByTestId('btn-save-exercise').click();

	await expect(page).toHaveURL(/\/exercises$/);
	await page.getByTestId('field-exercise-search').fill('My Cable Fly');
	await expect(page.getByTestId('exercise-row').filter({ hasText: 'My Cable Fly' })).toBeVisible();
});
