import { expect, test } from '@playwright/test';
import { createRoutine, expectServerCount, register } from './helpers';

test('settings shows the app version', async ({ page }) => {
	await register(page);
	await page.goto('/settings');
	// "<semver>+<sha> · <date>" — assert the build-identity shape is rendered.
	await expect(page.getByTestId('app-version')).toContainText('+');
});

test('reset local data clears the cache and re-pulls from the server', async ({ page, baseURL }) => {
	await register(page);
	await createRoutine(page, 'KeepMe');
	// Make sure it's pushed to the server before we wipe the local copy.
	await expectServerCount(page, baseURL!, '/api/v1/routines', 'routines', 1);

	await page.goto('/settings');
	page.on('dialog', (d) => d.accept());
	await page.getByTestId('btn-reset-local').click();
	await page.waitForLoadState('networkidle'); // clear → resync → reload

	// The routine is gone from the wiped cache but comes back from the server.
	await page.goto('/routines');
	await expect(page.getByTestId('routine-row').filter({ hasText: 'KeepMe' })).toBeVisible();
});
