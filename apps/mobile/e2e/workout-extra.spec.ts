import { expect, test } from '@playwright/test';
import { createRoutine, logWorkout, register } from './helpers';

test('quick deload scales prefilled weights from a routine', async ({ page }) => {
	await register(page);

	// A routine with a 100 kg target set.
	await page.goto('/routines');
	await page.getByTestId('btn-new-routine').click();
	await page.getByTestId('field-routine-title').fill('Deload Test');
	await page.getByTestId('btn-add-exercise').click();
	await page.getByTestId('picker-exercise').first().click();
	await page.getByTestId('field-target-weight').first().fill('100');
	await page.getByTestId('btn-save-routine').click();
	await expect(page).toHaveURL(/\/routines$/);

	// Start it → the set prefills at 100.
	await page.getByTestId('btn-start-routine').first().click();
	await expect(page).toHaveURL(/\/log\?routine=/);
	await expect(page.getByTestId('input-weight').first()).toHaveValue('100');

	// −10% → 90, then back to none → 100 (non-compounding, restores originals).
	await page.getByTestId('field-deload').selectOption('10');
	await expect(page.getByTestId('input-weight').first()).toHaveValue('90');
	await page.getByTestId('field-deload').selectOption('0');
	await expect(page.getByTestId('input-weight').first()).toHaveValue('100');
});

test('opens exercise stats by tapping an exercise in a workout', async ({ page }) => {
	await register(page);
	const name = await logWorkout(page);

	// Open the workout detail from history.
	await page.getByTestId('workout-row').first().click();
	await expect(page).toHaveURL(/\/history\/.+/);

	// Tap the exercise → its progress/stats page.
	await page.getByTestId('wd-exercise-link').first().click();
	await expect(page).toHaveURL(/\/exercises\/.+/);
	await expect(page.getByRole('heading', { name })).toBeVisible();
});

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

	// Switching its type to warm-up marks the row as a ramp-rail set and drops the number.
	await page.getByTestId('set-type').first().selectOption('warmup');
	await expect(page.getByTestId('set-row').first()).toHaveClass(/warmup/);
	await expect(page.getByTestId('set-label').first()).toHaveText('');
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
