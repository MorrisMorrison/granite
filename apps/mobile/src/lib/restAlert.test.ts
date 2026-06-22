import { afterEach, describe, expect, it, vi } from 'vitest';

import { restAlert } from './restAlert';

afterEach(() => vi.unstubAllGlobals());

describe('restAlert', () => {
	it('triggers a vibration when the device supports it', () => {
		const vibrate = vi.fn();
		vi.stubGlobal('navigator', { vibrate });

		restAlert();

		expect(vibrate).toHaveBeenCalledWith([200, 100, 200]);
	});

	it('no-ops safely when vibration is unsupported', () => {
		vi.stubGlobal('navigator', {});
		expect(() => restAlert()).not.toThrow();
	});
});
