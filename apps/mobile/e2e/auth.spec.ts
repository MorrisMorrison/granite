import { expect, test } from '@playwright/test';
import { PASSWORD, register } from './helpers';

test('register, log out, log back in', async ({ page }) => {
	const email = await register(page);

	await page.getByTestId('btn-logout').click();
	await expect(page).toHaveURL(/\/login$/);

	await page.getByTestId('field-email').fill(email);
	await page.getByTestId('field-password').fill(PASSWORD);
	await page.getByTestId('btn-login').click();

	await expect(page.getByTestId('btn-start-workout')).toBeVisible();
});
