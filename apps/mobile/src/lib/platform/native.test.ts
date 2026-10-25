// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

const { schedule, cancel, checkPermissions, requestPermissions, keepAwakeOn, allowSleep } = vi.hoisted(() => ({
	schedule: vi.fn(() => Promise.resolve()),
	cancel: vi.fn(() => Promise.resolve()),
	checkPermissions: vi.fn(() => Promise.resolve({ display: 'prompt' })),
	requestPermissions: vi.fn(() => Promise.resolve({ display: 'granted' })),
	keepAwakeOn: vi.fn(() => Promise.resolve()),
	allowSleep: vi.fn(() => Promise.resolve())
}));
vi.mock('@capacitor/local-notifications', () => ({
	LocalNotifications: { schedule, cancel, checkPermissions, requestPermissions }
}));
vi.mock('@capacitor-community/keep-awake', () => ({ KeepAwake: { keepAwake: keepAwakeOn, allowSleep } }));

describe('platform seam on a device', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
	});
	afterEach(() => vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false));

	it('asks for permission once, then schedules the rest notification at the end time', async () => {
		await scheduleRestEnd(5_000);
		expect(requestPermissions).toHaveBeenCalledTimes(1);
		expect(cancel).toHaveBeenCalledWith({ notifications: [{ id: 1 }] });
		expect(schedule).toHaveBeenCalledWith({
			notifications: [
				expect.objectContaining({ id: 1, title: 'Rest over', body: 'Time for your next set.', schedule: { at: new Date(5_000), allowWhileIdle: true } })
			]
		});
	});

	it('does not schedule when permission is denied', async () => {
		checkPermissions.mockResolvedValueOnce({ display: 'denied' });
		schedule.mockClear();
		await scheduleRestEnd(5_000);
		expect(schedule).not.toHaveBeenCalled();
	});

	it('cancels and toggles keep-awake', async () => {
		await cancelRestEnd();
		expect(cancel).toHaveBeenCalledWith({ notifications: [{ id: 1 }] });
		await keepAwake(true);
		expect(keepAwakeOn).toHaveBeenCalled();
		await keepAwake(false);
		expect(allowSleep).toHaveBeenCalled();
	});
});
