import { expect, test } from '@playwright/test';
import { createRoutine, logWorkout, register } from './helpers';

test('starts a workout prefilled from a routine', async ({ page }) => {
	await register(page);
	await createRoutine(page, 'Push Day');

	// Start the routine from its row.
	await page.getByTestId('btn-start-routine').first().click();
	await expect(page).toHaveURL(/\/log\?routine=/);

	// Prefilled, not a blank workout: the routine's title and its exercise are
	// already present (the empty-workout picker never opens).
	await expect(page.locator('input.title')).toHaveValue('Push Day');
	await expect(page.getByTestId('set-row')).toBeVisible();
});

test('shows the previous session values as set placeholders', async ({ page }) => {
	await register(page);

	// Session 1 establishes a "last performance" for the first exercise.
	await logWorkout(page, '60', '5');

	// Start session 2 and add the same (first) exercise.
	await page.goto('/');
	await page.getByTestId('btn-start-workout').click();
	await expect(page).toHaveURL(/\/log$/);
	await page.getByTestId('picker-exercise').first().click();

	// The empty inputs hint last time's numbers (loaded async → auto-retried).
	await expect(page.getByTestId('input-weight').first()).toHaveAttribute('placeholder', '60');
	await expect(page.getByTestId('input-reps').first()).toHaveAttribute('placeholder', '5');
});
