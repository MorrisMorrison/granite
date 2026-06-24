import { expect, test } from '@playwright/test';
import { logWorkout, register } from './helpers';

test('history calendar marks workout days and filters the list on tap', async ({ page }) => {
	await register(page);
	await logWorkout(page); // lands on /history

	// Month shows the workout count, and today is a marked day.
	await expect(page.getByTestId('cal-title')).toContainText('1 workout');
	await expect(page.getByTestId('workout-row')).toHaveCount(1);

	// Tap the marked day → the list filters to it, with a clear control.
	await page.getByTestId('cal-day-marked').first().click();
	await expect(page.getByTestId('clear-day')).toBeVisible();
	await expect(page.getByTestId('workout-row')).toHaveCount(1);

	// Clear → back to the full list.
	await page.getByTestId('clear-day').click();
	await expect(page.getByTestId('clear-day')).toHaveCount(0);

	// No future browsing — the next arrow is disabled on the current month.
	await expect(page.getByTestId('cal-next')).toBeDisabled();
});
