import { expect, type Page } from '@playwright/test';

export const PASSWORD = 'supersecret123';

/** Register a fresh, unique user and land on the authenticated home (Today). */
export async function register(page: Page): Promise<string> {
	const email = `e2e_${Date.now()}_${Math.floor(Math.random() * 1e6)}@test.local`;
	await page.goto('/register');
	await page.getByTestId('field-email').fill(email);
	await page.getByTestId('field-password').fill(PASSWORD);
	await page.getByTestId('btn-register').click();
	await expect(page.getByTestId('btn-start-workout')).toBeVisible();
	return email;
}

/** Log in an existing user (e.g. a second client) and land on Today. */
export async function loginAs(page: Page, email: string, password = PASSWORD): Promise<void> {
	await page.goto('/login');
	await page.getByTestId('field-email').fill(email);
	await page.getByTestId('field-password').fill(password);
	await page.getByTestId('btn-login').click();
	await expect(page.getByTestId('btn-start-workout')).toBeVisible();
}

/**
 * Log a one-set workout from Today and return the (first-in-library) exercise's
 * name. Caller must already be on Today (`/`). Uses in-app navigation only (no
 * full page loads), so it also works offline once the exercise library has been
 * synced into local storage.
 */
export async function logWorkout(page: Page, weight = '60', reps = '5'): Promise<string> {
	await page.getByTestId('btn-start-workout').click();
	await expect(page).toHaveURL(/\/log$/);
	// The picker opens automatically on a fresh workout; add (and name) the first exercise.
	const first = page.getByTestId('picker-exercise').first();
	const name = (await first.locator('span').first().innerText()).trim();
	await first.click();
	await expect(page.getByTestId('set-row')).toBeVisible();
	await page.getByTestId('input-weight').fill(weight);
	await page.getByTestId('input-reps').fill(reps);
	await page.getByTestId('set-complete').check();
	await page.getByTestId('btn-finish-workout').click();
	await expect(page).toHaveURL(/\/history$/);
	return name;
}

/** Create a routine with `title` and one (first-in-library) exercise; lands back on /routines. */
export async function createRoutine(page: Page, title: string): Promise<void> {
	await page.goto('/routines');
	await page.getByTestId('btn-new-routine').click();
	await page.getByTestId('field-routine-title').fill(title);
	await page.getByTestId('btn-add-exercise').click();
	await page.getByTestId('picker-exercise').first().click();
	await page.getByTestId('btn-save-routine').click();
	await expect(page).toHaveURL(/\/routines$/);
	await expect(page.getByTestId('routine-row').filter({ hasText: title })).toBeVisible();
}

/**
 * Poll the server's REST API (using the page's stored access token) until the
 * collection at `path` holds `count` items. Lets a sync assertion wait for the
 * background push/pull to actually reach the server instead of racing it.
 */
export async function expectServerCount(
	page: Page,
	baseURL: string,
	path: string,
	key: string,
	count: number
): Promise<void> {
	await expect
		.poll(
			async () => {
				const token = await page.evaluate(() => localStorage.getItem('granite.access'));
				if (!token) return -1;
				const res = await page.request.get(`${baseURL}${path}`, {
					headers: { Authorization: `Bearer ${token}` }
				});
				if (!res.ok()) return -1;
				const body = await res.json();
				return Array.isArray(body[key]) ? body[key].length : -1;
			},
			{ timeout: 15_000 }
		)
		.toBe(count);
}

/**
 * Poll until the (first) routine on the server has been filed under a folder,
 * i.e. its `folder_id` is set. Ensures a "move into folder" has actually synced
 * before a second client pulls — otherwise the move can still be in flight.
 */
export async function expectRoutineFoldered(page: Page, baseURL: string): Promise<void> {
	await expect
		.poll(
			async () => {
				const token = await page.evaluate(() => localStorage.getItem('granite.access'));
				if (!token) return null;
				const res = await page.request.get(`${baseURL}/api/v1/routines`, {
					headers: { Authorization: `Bearer ${token}` }
				});
				if (!res.ok()) return null;
				const body = await res.json();
				return body.routines?.[0]?.folder_id ?? null;
			},
			{ timeout: 15_000 }
		)
		.toBeTruthy();
}
