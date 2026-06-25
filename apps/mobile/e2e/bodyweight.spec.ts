import { expect, test } from '@playwright/test';
import { register } from './helpers';

test('logs bodyweight and surfaces it on Today', async ({ page }) => {
	await register(page);

	// Open the bodyweight screen from the Today link.
	await page.getByTestId('bodyweight-link').click();
	await expect(page).toHaveURL(/\/bodyweight$/);

	await page.getByTestId('field-bodyweight').fill('82.5');
	await page.getByTestId('btn-log-bodyweight').click();
	await expect(page.getByTestId('bw-row')).toHaveCount(1);
	await expect(page.getByText('82.5 kg')).toBeVisible();

	// Today now shows the latest weight.
	await page.goto('/');
	await expect(page.getByTestId('bodyweight-link')).toContainText('82.5');
});
