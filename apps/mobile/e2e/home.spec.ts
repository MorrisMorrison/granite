import { expect, test } from '@playwright/test';
import { createRoutine, logWorkout, register } from './helpers';

test('home shows training stats after logging a workout', async ({ page }) => {
	await register(page);
	await logWorkout(page);

	await page.goto('/');
	await expect(page.getByTestId('home-stats')).toBeVisible();
	await expect(page.getByTestId('stat-this-week')).toHaveText('1');
	await expect(page.getByTestId('stat-streak')).toHaveText('1');
	await expect(page.getByTestId('home-stats')).toContainText('1 workout · 1-wk streak');
	await expect(page.getByTestId('today-last-workout')).toContainText('Today');
	await expect(page.getByTestId('today-last-workout')).toContainText('min');
});

test('Today suggests the next routine and rotates after a workout', async ({ page }) => {
	await register(page);
	await createRoutine(page, 'A day');
	await createRoutine(page, 'B day');

	await page.goto('/');
	const hero = page.getByTestId('today-next-routine');
	await expect(hero).toContainText('A day');
	await expect(hero).toContainText('1 exercise');
	await expect(page.getByTestId('btn-start-workout')).toBeVisible();

	// Start "A day" from the hero and finish a set.
	await page.getByTestId('today-start-routine').click();
	await expect(page).toHaveURL(/\/log\?routine=/);
	await page.getByTestId('input-weight').first().fill('60');
	await page.getByTestId('input-reps').first().fill('5');
	await page.getByTestId('set-complete').first().check();
	await page.getByTestId('btn-finish-workout').click();
	await expect(page).toHaveURL(/\/history$/);

	// Back on Today the hero rotates to "B day".
	await page.goto('/');
	await expect(page.getByTestId('today-next-routine')).toContainText('B day');
	await expect(page.getByTestId('today-start-routine')).toContainText('Start B day');
});
