import { expect, test } from '@playwright/test';
import { register } from './helpers';

// One test (one registration): the auth rate limit is per IP across the suite.
test('exercise picker: search narrows the list; no match offers to create it', async ({ page }) => {
	await register(page);

	// Routine editor: the search field is focused on open, so typing goes straight in.
	await page.goto('/routines');
	await page.getByTestId('btn-new-routine').click();
	await page.getByTestId('field-routine-title').fill('Leg Day');
	await page.getByTestId('btn-add-exercise').click();
	await expect(page.getByTestId('field-picker-search')).toBeFocused();
	await page.keyboard.type('back squat');

	const rows = page.getByTestId('picker-exercise');
	await expect(rows).toHaveCount(1);
	await expect(rows.first()).toContainText('Barbell Back Squat');
	await rows.first().click();
	await expect(page.locator('main')).toContainText('Barbell Back Squat');
	await page.getByTestId('btn-save-routine').click();
	await expect(page.getByTestId('routine-row').filter({ hasText: 'Leg Day' })).toBeVisible();

	// Logger shares the same picker (opens automatically on a fresh workout).
	await page.goto('/');
	await page.getByTestId('btn-start-workout').click();
	await expect(page).toHaveURL(/\/log$/);
	await page.getByTestId('field-picker-search').fill('Zercher Squat');
	await expect(page.getByTestId('picker-exercise')).toHaveCount(0);
	await expect(page.getByTestId('picker-empty')).toContainText('No exercises match');

	await page.getByRole('button', { name: 'Create “Zercher Squat”' }).click();
	await expect(page.getByTestId('field-exercise-name')).toHaveValue('Zercher Squat');
	await page.getByTestId('field-exercise-muscle').fill('Quadriceps');
	await page.getByTestId('btn-save-exercise').click();
	await expect(page.getByTestId('set-row')).toBeVisible();
	await expect(page.locator('main')).toContainText('Zercher Squat');
});
