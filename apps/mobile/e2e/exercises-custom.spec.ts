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

test('create a custom exercise inline from the workout picker', async ({ page }) => {
	await register(page);

	// Start a fresh workout — the exercise picker opens automatically.
	await page.getByTestId('btn-start-workout').click();
	await expect(page).toHaveURL(/\/log$/);

	// Create a new exercise from inside the picker instead of scrolling the library.
	await page.getByTestId('btn-picker-new-exercise').click();
	await page.getByTestId('field-exercise-name').fill('Inline Cable Press');
	await page.getByTestId('field-exercise-muscle').fill('Chest');
	await page.getByTestId('btn-save-exercise').click();

	// It's dropped straight into the workout, ready to log.
	await expect(page.getByText('Inline Cable Press')).toBeVisible();
	await expect(page.getByTestId('set-row')).toBeVisible();
});
