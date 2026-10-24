import { describe, expect, it } from 'vitest';
import { installText, offersButton, platformOf, sheetSteps, shouldOffer } from './install';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1';
const IPAD = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15';
const ANDROID = 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/150.0 Mobile Safari/537.36';
const INSTAGRAM = `${IPHONE} Instagram 350.0`;
const DESKTOP = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/150.0 Safari/537.36';

describe('platformOf', () => {
	it('detects phones, tablets, in-app browsers and desktops', () => {
		expect(platformOf(IPHONE)).toBe('ios');
		expect(platformOf(IPAD, 5)).toBe('ios'); // iPad reports a Mac with touch
		expect(platformOf(IPAD, 0)).toBe('desktop'); // a real Mac
		expect(platformOf(ANDROID)).toBe('android');
		expect(platformOf(INSTAGRAM)).toBe('inapp');
		expect(platformOf(DESKTOP)).toBe('desktop');
		expect(platformOf()).toBe('desktop');
	});
});

describe('offersButton / shouldOffer', () => {
	const base = { platform: 'ios' as const, standalone: false, dismissed: false, workouts: 1 };

	it('offers on phones until Granite runs from the home screen', () => {
		expect(offersButton(base)).toBe(true);
		expect(offersButton({ ...base, standalone: true })).toBe(false);
		expect(offersButton({ ...base, platform: 'desktop' })).toBe(false);
	});

	it('shows the card only after a first workout and until dismissed', () => {
		expect(shouldOffer(base)).toBe(true);
		expect(shouldOffer({ ...base, workouts: 0 })).toBe(false);
		expect(shouldOffer({ ...base, dismissed: true })).toBe(false);
		expect(shouldOffer({ ...base, standalone: true })).toBe(false);
		expect(shouldOffer({ ...base, platform: 'desktop' })).toBe(false);
	});
});

describe('sheetSteps / installText', () => {
	it('uses the words of each browser', () => {
		expect(sheetSteps('ios').join(' ')).toContain('Add to Home Screen');
		expect(sheetSteps('android').join(' ')).toContain('Install app');
		expect(sheetSteps('inapp').join(' ')).toContain('Open in browser');
	});

	it('mentions the install prompt only when there is one', () => {
		expect(installText('android', true)).toContain('Install Granite');
		expect(installText('android', false)).toContain('browser’s menu');
		expect(installText('ios', false)).toContain('Add to Home Screen');
		expect(installText('inapp', false)).toContain('Safari or Chrome');
	});
});
