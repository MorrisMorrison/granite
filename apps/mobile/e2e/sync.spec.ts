import { expect, test } from '@playwright/test';
import { expectRoutineFoldered, expectServerCount, loginAs, logWorkout, register } from './helpers';

// Sync is the riskiest part of the system. These run two independent browser
// contexts (two "devices") for the same account and assert data created on one
// shows up on the other — the cross-client behavior the single-context specs
// can't reach.

test('a workout logged on one client appears on another after sync', async ({
	page,
	browser,
	baseURL
}) => {
	const email = await register(page);
	await logWorkout(page);
	await expect(page.getByTestId('workout-row')).toHaveCount(1);

	// Make sure client A has pushed before client B pulls — no race.
	await expectServerCount(page, baseURL!, '/api/v1/workouts', 'workouts', 1);

	const ctxB = await browser.newContext();
	try {
		const pageB = await ctxB.newPage();
		await loginAs(pageB, email);
		await pageB.goto('/history');
		await expect(pageB.getByTestId('workout-row')).toHaveCount(1, { timeout: 15_000 });
	} finally {
		await ctxB.close();
	}
});

test('a folder + routine created on one client sync grouped to another', async ({
	page,
	browser,
	baseURL
}) => {
	const email = await register(page);

	// Create a routine on client A.
	await page.goto('/routines');
	await page.getByTestId('btn-new-routine').click();
	await page.getByTestId('field-routine-title').fill('Push Day');
	await page.getByTestId('btn-add-exercise').click();
	await page.getByTestId('picker-exercise').first().click();
	await page.getByTestId('btn-save-routine').click();
	await expect(page).toHaveURL(/\/routines$/);

	// Create a folder and move the routine into it.
	await page.getByTestId('btn-new-folder').click();
	await page.getByTestId('field-folder-name').fill('Strength');
	await page.getByTestId('btn-save-folder').click();
	await expect(page.getByTestId('folder').filter({ hasText: 'Strength' })).toBeVisible();
	await page.getByTestId('btn-routine-menu').first().click();
	await page.getByTestId('move-target').filter({ hasText: 'Strength' }).click();
	await expect(page.getByTestId('folder').filter({ hasText: 'Strength' })).toContainText('Push Day');

	// Ensure A has pushed the folder AND the move (routine.folder_id) before B
	// pulls — otherwise B can pull the routine while it's still ungrouped.
	await expectServerCount(page, baseURL!, '/api/v1/routine-folders', 'folders', 1);
	await expectRoutineFoldered(page, baseURL!);

	// Client B must see the routine grouped under the folder — a direct
	// regression guard for the routine_folder sync-entity bug (#54).
	const ctxB = await browser.newContext();
	try {
		const pageB = await ctxB.newPage();
		await loginAs(pageB, email);
		await pageB.goto('/routines');
		await expect(pageB.getByTestId('folder').filter({ hasText: 'Strength' })).toContainText(
			'Push Day',
			{ timeout: 15_000 }
		);
	} finally {
		await ctxB.close();
	}
});
