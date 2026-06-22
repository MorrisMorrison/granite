import { expect, test } from '@playwright/test';
import { register } from './helpers';

test('searches and filters the exercise library', async ({ page }) => {
	await register(page);
	await page.goto('/exercises');

	const rows = page.getByTestId('exercise-row');
	await expect(rows.first()).toBeVisible();
	const total = await rows.count();
	expect(total).toBeGreaterThan(1);

	// Searching a specific exercise's name narrows the list (that row stays).
	const firstName = (await rows.first().innerText()).split('\n')[0].trim();
	await page.getByTestId('field-exercise-search').fill(firstName);
	await expect(rows.filter({ hasText: firstName }).first()).toBeVisible();
	await expect.poll(async () => rows.count()).toBeLessThan(total);

	// A no-match query shows the empty state.
	await page.getByTestId('field-exercise-search').fill('zzzznomatch');
	await expect(rows).toHaveCount(0);
	await expect(page.getByText('No matches')).toBeVisible();
});
