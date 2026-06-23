import { expect, test } from '@playwright/test';
import { createRoutine, expectServerCount, register } from './helpers';

// Round-trip the data-portability flow: export to a file, then import that file
// back. Re-importing your own export upserts by id (idempotent), so the routine
// counts as imported — proving the file → POST /import → result path works.
test('exports data and imports the file back', async ({ page, baseURL }) => {
	await register(page);
	await createRoutine(page, 'PortMe');
	// Export reads server-side, so make sure the routine has been pushed.
	await expectServerCount(page, baseURL!, '/api/v1/routines', 'routines', 1);

	await page.goto('/settings');

	// Export downloads a JSON file.
	const downloadPromise = page.waitForEvent('download');
	await page.getByTestId('btn-export').click();
	const exportPath = await (await downloadPromise).path();
	expect(exportPath).toBeTruthy();

	// Import it back through the hidden file input.
	await page.getByTestId('field-import').setInputFiles(exportPath!);
	await expect(page.getByText(/Imported 1 routine/)).toBeVisible();
});

test('imports a Hevy CSV export', async ({ page }) => {
	await register(page);
	await page.goto('/settings');

	const csv = [
		'title,start_time,end_time,description,exercise_title,superset_id,exercise_notes,set_index,set_type,weight_kg,reps,distance_km,duration_seconds,rpe',
		'"Push A","Jun 23, 2026, 12:27 PM","Jun 23, 2026, 1:50 PM","","Bench Press (Barbell)","",,0,normal,100,5,,,',
		'"Push A","Jun 23, 2026, 12:27 PM","Jun 23, 2026, 1:50 PM","","Overhead Squat","",,0,normal,60,3,,,'
	].join('\n');

	await page.getByTestId('field-import-hevy').setInputFiles({
		name: 'workouts.csv',
		mimeType: 'text/csv',
		buffer: Buffer.from(csv)
	});
	await expect(page.getByText(/Imported 1 workout/)).toBeVisible();
});
