import { expect, test } from '@playwright/test';
import { logWorkout, register } from './helpers';

const IPHONE_UA =
	'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1';
const ANDROID_UA =
	'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/150.0 Mobile Safari/537.36';

test.describe('iPhone', () => {
	test.use({ userAgent: IPHONE_UA, viewport: { width: 390, height: 844 }, hasTouch: true });

	test('header button shows the Share steps; card appears after a workout and stays dismissed', async ({
		page
	}) => {
		await register(page);

		// No card on a first visit, but the header button is there.
		await expect(page.getByTestId('install-card')).toHaveCount(0);
		await page.getByTestId('btn-install').click();
		await expect(page.getByTestId('install-steps')).toContainText('Add to Home Screen');
		await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click();

		// After a first workout the card suggests it; "No thanks" sticks across reloads.
		await page.goto('/');
		await logWorkout(page);
		await page.goto('/');
		const card = page.getByTestId('install-card');
		await expect(card).toContainText('Add to Home Screen');
		await page.getByTestId('btn-install-dismiss').click();
		await expect(card).toHaveCount(0);
		await page.reload();
		await expect(page.getByTestId('btn-start-workout')).toBeVisible();
		await expect(card).toHaveCount(0);
		await expect(page.getByTestId('btn-install')).toBeVisible(); // the header button stays
	});
});

test.describe('Android', () => {
	test.use({ userAgent: ANDROID_UA, viewport: { width: 412, height: 915 }, hasTouch: true });

	test('header button opens the browser install prompt when one is offered', async ({ page }) => {
		await register(page);
		// Chrome hands over its prompt via beforeinstallprompt; simulate an accepted one.
		await page.evaluate(() => {
			const e = new Event('beforeinstallprompt') as Event & Record<string, unknown>;
			e.prompt = () => {
				(window as unknown as { prompted: boolean }).prompted = true;
				return Promise.resolve();
			};
			e.userChoice = Promise.resolve({ outcome: 'accepted' });
			dispatchEvent(e);
		});
		await page.getByTestId('btn-install').click();
		await expect.poll(() => page.evaluate(() => (window as unknown as { prompted?: boolean }).prompted)).toBe(true);
		// Accepted → treated as installed: the button goes away.
		await expect(page.getByTestId('btn-install')).toHaveCount(0);
	});
});

test('desktop shows no install button', async ({ page }) => {
	await register(page);
	await expect(page.getByTestId('btn-install')).toHaveCount(0);
});
