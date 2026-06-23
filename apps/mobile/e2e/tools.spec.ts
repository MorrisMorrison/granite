import { expect, test } from '@playwright/test';
import { register } from './helpers';

test('calculators: plate breakdown, 1RM, and warm-ups', async ({ page }) => {
	await register(page);

	// Reachable from the app-bar icon.
	await page.getByTestId('nav-tools').click();
	await expect(page).toHaveURL(/\/tools$/);

	// Plates: 100 on a 20 bar → 25 + 15 per side (default unit kg).
	await page.getByTestId('field-plate-target').fill('100');
	await expect(page.getByTestId('plate-result')).toContainText('25');

	// 1RM: 100 × 5 → ~117.
	await page.getByTestId('field-1rm-weight').fill('100');
	await page.getByTestId('field-1rm-reps').fill('5');
	await expect(page.getByTestId('rm-result')).toContainText('1RM');

	// Warm-ups appear for a working weight.
	await page.getByTestId('field-warmup-weight').fill('100');
	await expect(page.getByTestId('warmup-result').getByRole('listitem')).toHaveCount(3);
});
