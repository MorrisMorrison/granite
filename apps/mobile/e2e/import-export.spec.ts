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
