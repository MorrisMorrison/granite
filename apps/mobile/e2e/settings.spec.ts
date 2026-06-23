import { expect, test } from '@playwright/test';
import { register } from './helpers';

test('settings shows the app version', async ({ page }) => {
	await register(page);
	await page.goto('/settings');
	// "<semver>+<sha> · <date>" — assert the build-identity shape is rendered.
	await expect(page.getByTestId('app-version')).toContainText('+');
});
