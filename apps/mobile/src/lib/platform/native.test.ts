// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: vi.fn(() => false) } }));

import { Capacitor } from '@capacitor/core';
import { cancelRestEnd, isNative, keepAwake, scheduleRestEnd } from './native';

afterEach(() => {
	localStorage.clear();
	vi.unstubAllEnvs();
});

describe('platform seam on the web', () => {
	it('is not native and every native call is a harmless no-op', async () => {
		expect(isNative()).toBe(false);
		await expect(scheduleRestEnd(Date.now() + 60_000)).resolves.toBeUndefined();
		await expect(cancelRestEnd()).resolves.toBeUndefined();
		await expect(keepAwake(true)).resolves.toBeUndefined();
	});

	it('honours the e2e override only in e2e builds', () => {
		localStorage.setItem('granite.forceNative', '1');
		vi.stubEnv('VITE_E2E', '');
		expect(isNative()).toBe(false); // not an e2e build
		vi.stubEnv('VITE_E2E', '1');
		expect(isNative()).toBe(true);
	});

	it('reports native on a real device', () => {
		vi.mocked(Capacitor.isNativePlatform).mockReturnValueOnce(true);
		expect(isNative()).toBe(true);
	});
});
