import { expect, test } from '@playwright/test';

// The app ships as an installable PWA: a valid manifest + reachable icons, linked
// from the document head.
test('serves a valid PWA manifest with reachable icons', async ({ page, baseURL }) => {
	const res = await page.request.get(`${baseURL}/manifest.webmanifest`);
	expect(res.ok()).toBeTruthy();

	const manifest = await res.json();
	expect(manifest.name).toBe('Granite');
	expect(manifest.display).toBe('standalone');
	expect(Array.isArray(manifest.icons) && manifest.icons.length).toBeTruthy();
	expect(manifest.icons.some((i: { purpose?: string }) => i.purpose === 'maskable')).toBe(true);

	// Every icon the manifest advertises actually resolves.
	for (const icon of manifest.icons as { src: string }[]) {
		const img = await page.request.get(`${baseURL}${icon.src}`);
		expect(img.ok(), `icon ${icon.src}`).toBeTruthy();
	}

	// The document links the manifest.
	await page.goto('/login');
	await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/manifest.webmanifest');
});
