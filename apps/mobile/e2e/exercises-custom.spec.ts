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

test('archive a custom exercise, find it under Archived, and restore it', async ({ page }) => {
	await register(page);
	await page.goto('/exercises/new');
	await page.getByTestId('field-exercise-name').fill('Zercher Squat');
	await page.getByTestId('field-exercise-muscle').fill('Quadriceps');
	await page.getByTestId('btn-save-exercise').click();
	await expect(page).toHaveURL(/\/exercises$/);

	// Archive it from its detail page's actions menu.
	await page.getByTestId('field-exercise-search').fill('Zercher');
	await page.getByTestId('exercise-row').filter({ hasText: 'Zercher Squat' }).click();
	page.once('dialog', (d) => d.accept());
	await page.getByTestId('btn-exercise-menu').click();
	await page.getByTestId('btn-archive-exercise').click();
	await expect(page).toHaveURL(/\/exercises$/);

	// Gone from the library, listed under the collapsed Archived section.
	await page.getByTestId('field-exercise-search').fill('Zercher');
	await expect(page.getByTestId('exercise-row')).toHaveCount(0);
	await page.getByTestId('btn-show-archived').click();
	await page.getByTestId('archived-exercise-row').filter({ hasText: 'Zercher Squat' }).click();

	// Restore it (menu), then it's back in the library.
	await page.getByTestId('btn-exercise-menu').click();
	await page.getByTestId('btn-restore-exercise').click();
	await page.getByTestId('btn-exercise-menu').click();
	await expect(page.getByTestId('btn-archive-exercise')).toBeVisible();
	await page.goto('/exercises');
	await page.getByTestId('field-exercise-search').fill('Zercher');
	await expect(page.getByTestId('exercise-row').filter({ hasText: 'Zercher Squat' })).toBeVisible();
	await expect(page.getByTestId('btn-show-archived')).toHaveCount(0);
});
