import { expect, test } from '@playwright/test';
import { logWorkout, register } from './helpers';

test('surfaces PRs and session history for an exercise', async ({ page }) => {
	await register(page);

	// Two sessions of the same (first-in-library) exercise, second one heavier.
	const name = await logWorkout(page, '60', '5');
	await page.goto('/');
	await logWorkout(page, '80', '5');

	// Open that exercise's detail (exact-name match avoids substring collisions).
	await page.goto('/exercises');
	await page
		.getByTestId('exercise-row')
		.filter({ has: page.getByText(name, { exact: true }) })
		.click();

	await expect(page.getByTestId('exercise-detail')).toContainText(name);
	await expect(page.getByTestId('pr-weight')).toContainText('80');
	await expect(page.getByTestId('session-row')).toHaveCount(2);
});

test('round-trips weights in the selected unit (lb)', async ({ page }) => {
	await register(page);

	// Switch the account's display unit to pounds. The unit lives in synced
	// account settings and auth bootstrap re-hydrates it on every load, so wait
	// for the PATCH to land, then reload to confirm it stuck (no hydrate race).
	await page.goto('/settings');
	const saved = page.waitForResponse(
		(r) => r.url().includes('/api/v1/me') && r.request().method() === 'PATCH'
	);
	await page.getByTestId('field-weight-unit').selectOption('lb');
	await saved;
	await page.reload();
	await expect(page.getByTestId('field-weight-unit')).toHaveValue('lb');

	// Log 100 lb; it's stored in kg and must read back as 100 lb on the detail PR.
	await page.goto('/');
	const name = await logWorkout(page, '100', '5');

	await page.goto('/exercises');
	await page
		.getByTestId('exercise-row')
		.filter({ has: page.getByText(name, { exact: true }) })
		.click();

	await expect(page.getByTestId('pr-weight')).toContainText('100 lb');
});
