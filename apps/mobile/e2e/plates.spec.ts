import { expect, test } from '@playwright/test';
import { register } from './helpers';

test('logger plate calculator: barbell only, opens on the next set, writes back', async ({ page }) => {
	await register(page);
	await page.getByTestId('btn-start-workout').click();
	await expect(page).toHaveURL(/\/log$/);

	// A barbell exercise with two 100 kg sets.
	await page.getByTestId('field-picker-search').fill('Barbell Bench Press');
	await page.getByTestId('picker-exercise').first().click();
	await page.getByTestId('input-weight').fill('100');
	await page.getByTestId('input-reps').fill('5');
	await page.getByRole('button', { name: 'Add set' }).click();
	await page.getByTestId('set-complete').first().check();

	// Opens on set 2 (the next one to load): 100 on a 20 bar → 25 + 15 per side.
	await page.getByTestId('btn-plates').click();
	const chips = page.getByTestId('plate-set-chip');
	await expect(chips.nth(1)).toHaveAttribute('aria-selected', 'true');
	await expect(page.getByTestId('plate-result')).toContainText('Each side 25 + 15');

	// The stepper writes back to that set only.
	await page.getByRole('button', { name: 'Plus 2.5 kg' }).click();
	await expect(page.getByTestId('plate-result')).toContainText('Each side 25 + 15 + 1.25');
	await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click();
	await expect(page.getByTestId('input-weight').nth(1)).toHaveValue('102.5');
	await expect(page.getByTestId('input-weight').nth(0)).toHaveValue('100');

	// Non-barbell exercises get no plate button.
	await page.getByTestId('btn-add-exercise').click();
	await page.getByTestId('field-picker-search').fill('Dumbbell Row');
	await page.getByTestId('picker-exercise').first().click();
	await expect(page.getByTestId('btn-plates')).toHaveCount(1);
});
