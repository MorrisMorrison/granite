import { expect, test } from '@playwright/test';
import { PASSWORD } from './helpers';

// The e2e build honours granite.forceNative, so the web build behaves like the app.
test('native: connect → register → change server signs out and returns to /connect', async ({ page, baseURL }) => {
	await page.addInitScript(() => localStorage.setItem('granite.forceNative', '1'));
	await page.goto('/');
	await expect(page).toHaveURL(/\/connect$/);

	// Wrong address first: plain-language error, stays on /connect.
	await page.getByTestId('field-server-url').fill('http://127.0.0.1:9');
	await page.getByTestId('btn-connect').click();
	await expect(page.getByTestId('connect-error')).toContainText('No server answered');

	// The e2e server itself is a current Granite server.
	await page.getByTestId('field-server-url').fill(baseURL!);
	await page.getByTestId('btn-connect').click();
	await expect(page).toHaveURL(/\/login$/);
	await expect(page.getByTestId('server-line')).toContainText(new URL(baseURL!).host);

	// Register, then change server from Settings.
	await page.goto('/register');
	await page.getByTestId('field-email').fill(`native_${Date.now()}@test.local`);
	await page.getByTestId('field-password').fill(PASSWORD);
	await page.getByTestId('btn-register').click();
	await expect(page.getByTestId('btn-start-workout')).toBeVisible();

	// Change server from Settings: signs out and returns to /connect, prefilled.
	await page.goto('/settings');
	page.once('dialog', (d) => d.accept());
	await page.getByTestId('btn-settings-change-server').click();
	await expect(page).toHaveURL(/\/connect\?change=1$/);
	await expect(page.getByTestId('field-server-url')).toHaveValue(baseURL!);
});

test('web: no connect step, no server line; /connect redirects to login', async ({ page }) => {
	await page.goto('/login');
	await expect(page).toHaveURL(/\/login$/);
	await expect(page.getByTestId('server-line')).toHaveCount(0);
	await page.goto('/connect');
	await expect(page).toHaveURL(/\/login$/);
});
