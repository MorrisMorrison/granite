import { expect, test } from '@playwright/test';
import { register } from './helpers';

test('create a routine, a folder, and move the routine into it', async ({ page }) => {
	await register(page);
	await page.goto('/routines');

	// Create a routine.
	await page.getByTestId('btn-new-routine').click();
	await expect(page).toHaveURL(/\/routines\/new$/);
	await page.getByTestId('field-routine-title').fill('Push Day');
	await page.getByTestId('btn-add-exercise').click();
	await page.getByTestId('picker-exercise').first().click();
	await page.getByTestId('btn-save-routine').click();

	await expect(page).toHaveURL(/\/routines$/);
	await expect(page.getByTestId('routine-row').filter({ hasText: 'Push Day' })).toBeVisible();

	// Create a folder.
	await page.getByTestId('btn-new-folder').click();
	await page.getByTestId('field-folder-name').fill('Strength');
	await page.getByTestId('btn-save-folder').click();
	await expect(page.getByTestId('folder').filter({ hasText: 'Strength' })).toBeVisible();

	// Move the routine into the folder via the kebab menu.
	await page.getByTestId('btn-routine-menu').first().click();
	await page.getByTestId('move-target').filter({ hasText: 'Strength' }).click();

	// The routine now lives inside the Strength folder section.
	await expect(page.getByTestId('folder').filter({ hasText: 'Strength' })).toContainText('Push Day');
});
