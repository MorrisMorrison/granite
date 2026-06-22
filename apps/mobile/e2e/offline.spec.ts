import { expect, test } from '@playwright/test';
import { expectServerCount, logWorkout, register } from './helpers';

// The defining promise of an offline-first tracker: logging works with the
// network down, survives a reload, and reconciles to the server on reconnect.
test('logs a workout offline, persists across a reload, and syncs on reconnect', async ({
	page,
	context,
	baseURL
}) => {
	await register(page);

	// Warm the exercise library into local storage while still online — the
	// picker reads it locally, so it must be present before we cut the network.
	await page.goto('/exercises');
	await expect(page.getByTestId('exercise-row').first()).toBeVisible();
	await page.goto('/');
	await expect(page.getByTestId('btn-start-workout')).toBeVisible();

	// --- Offline: the core path must work with no network. ---
	await context.setOffline(true);
	await logWorkout(page);
	await expect(page.getByTestId('workout-row')).toHaveCount(1);

	// --- Reconnect: reload re-runs sync; the workout persists locally AND
	// reaches the server (proving the offline write was pushed, not lost). ---
	await context.setOffline(false);
	await page.reload();
	await expect(page.getByTestId('workout-row')).toHaveCount(1);
	await expectServerCount(page, baseURL!, '/api/v1/workouts', 'workouts', 1);
});
