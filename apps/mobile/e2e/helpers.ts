import { expect, type Page } from '@playwright/test';

export const PASSWORD = 'supersecret123';

/** Register a fresh, unique user and land on the authenticated home (Today). */
export async function register(page: Page): Promise<string> {
	const email = `e2e_${Date.now()}_${Math.floor(Math.random() * 1e6)}@test.local`;
	await page.goto('/register');
	await page.getByTestId('field-email').fill(email);
	await page.getByTestId('field-password').fill(PASSWORD);
	await page.getByTestId('btn-register').click();
	await expect(page.getByTestId('btn-start-workout')).toBeVisible();
	return email;
}
