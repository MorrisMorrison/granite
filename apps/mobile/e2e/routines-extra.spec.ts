import { expect, test } from '@playwright/test';
import { createRoutine, register } from './helpers';

test('edits a routine title', async ({ page }) => {
	await register(page);
	await createRoutine(page, 'Leg Day');

	// The routine title links to its editor.
	await page.getByRole('link', { name: 'Leg Day' }).click();
	await expect(page).toHaveURL(/\/routines\/[^/]+$/);

	const titleField = page.getByTestId('field-routine-title');
	await expect(titleField).toHaveValue('Leg Day');
	await titleField.fill('Leg Day A');
	await page.getByTestId('btn-save-routine').click();

	await expect(page).toHaveURL(/\/routines$/);
	await expect(page.getByTestId('routine-row').filter({ hasText: 'Leg Day A' })).toBeVisible();
});

test('renames then deletes a folder', async ({ page }) => {
	await register(page);
	await page.goto('/routines');

	// Create.
	await page.getByTestId('btn-new-folder').click();
	await page.getByTestId('field-folder-name').fill('Strength');
	await page.getByTestId('btn-save-folder').click();
	await expect(page.getByTestId('folder').filter({ hasText: 'Strength' })).toBeVisible();

	// Rename.
	await page.getByRole('button', { name: 'Rename folder' }).click();
	const nameField = page.getByTestId('field-folder-name');
	await expect(nameField).toHaveValue('Strength');
	await nameField.fill('Power');
	await page.getByTestId('btn-save-folder').click();
	await expect(page.getByTestId('folder').filter({ hasText: 'Power' })).toBeVisible();
	await expect(page.getByTestId('folder').filter({ hasText: 'Strength' })).toHaveCount(0);

	// Delete (accept the confirm dialog).
	page.once('dialog', (d) => d.accept());
	await page.getByRole('button', { name: 'Delete folder' }).click();
	await expect(page.getByTestId('folder')).toHaveCount(0);
});
