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

test('opens a logged workout detail from history', async ({ page }) => {
	await register(page);
	const name = await logWorkout(page, '60', '5'); // lands on /history

	await page.getByTestId('workout-row').first().click();
	await expect(page).toHaveURL(/\/history\/[^/]+$/);

	const detail = page.getByTestId('workout-detail');
	await expect(detail).toContainText(name); // the logged exercise
	await expect(detail).toContainText('60'); // its weight
});

test('labels warm-up sets distinctly from work sets in the logger', async ({ page }) => {
	await register(page);
	await page.getByTestId('btn-start-workout').click();
	await page.getByTestId('picker-exercise').first().click();
	await expect(page.getByTestId('set-row')).toBeVisible();

	// First set defaults to a work set → numbered "1".
	await expect(page.getByTestId('set-label').first()).toHaveText('1');

	// Switching its type to warm-up relabels it "W".
	await page.getByTestId('set-type').first().selectOption('warmup');
	await expect(page.getByTestId('set-label').first()).toHaveText('W');
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
