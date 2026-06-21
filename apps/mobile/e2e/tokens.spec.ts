import { expect, test } from '@playwright/test';
import { register } from './helpers';

test('create and revoke an API token', async ({ page }) => {
	await register(page);

	await page.getByTestId('nav-settings').click();
	await expect(page).toHaveURL(/\/settings$/);

	await page.getByTestId('btn-new-token').click();
	await page.getByTestId('field-token-name').fill('CI token');
	await page.getByTestId('btn-create-token').click();

	// Plaintext token is shown once.
	await expect(page.getByTestId('new-token-value')).toContainText('gra_');
	await page.keyboard.press('Escape');

	await expect(page.getByTestId('token-row')).toHaveCount(1);

	// Revoke (a confirm() dialog gates it).
	page.once('dialog', (d) => d.accept());
	await page.getByTestId('btn-revoke-token').click();
	await expect(page.getByTestId('token-row')).toHaveCount(0);
});
