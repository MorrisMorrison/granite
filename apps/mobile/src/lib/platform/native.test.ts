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
		await expect(scheduleRestEnd(Date.now() + 60_000)).resolves.toBe(false);
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

const { schedule, cancel, checkPermissions, requestPermissions, createChannel, checkExact, keepAwakeOn, allowSleep } = vi.hoisted(() => ({
	schedule: vi.fn(() => Promise.resolve()),
	cancel: vi.fn(() => Promise.resolve()),
	checkPermissions: vi.fn(() => Promise.resolve({ display: 'prompt' })),
	requestPermissions: vi.fn(() => Promise.resolve({ display: 'granted' })),
	createChannel: vi.fn(() => Promise.resolve()),
	checkExact: vi.fn(() => Promise.resolve({ exact_alarm: 'granted' })),
	keepAwakeOn: vi.fn(() => Promise.resolve()),
	allowSleep: vi.fn(() => Promise.resolve())
}));
vi.mock('@capacitor/local-notifications', () => ({
	LocalNotifications: { schedule, cancel, checkPermissions, requestPermissions, createChannel, checkExactNotificationSetting: checkExact }
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

	it('a skip during a pending schedule leaves nothing scheduled', async () => {
		const order: string[] = [];
		schedule.mockImplementationOnce(() => {
			order.push('schedule');
			return Promise.resolve();
		});
		cancel.mockImplementation(() => {
			order.push('cancel');
			return Promise.resolve();
		});
		try {
			let release!: (v: { display: string }) => void;
			checkPermissions.mockImplementationOnce(() => new Promise((res) => (release = res)));
			const s = scheduleRestEnd(5_000);
			const c = cancelRestEnd();
			await new Promise((r) => setTimeout(r, 10)); // let the unqueued path (if any) run ahead
			release({ display: 'granted' });
			await Promise.all([s, c]);
			expect(order).toContain('schedule');
			expect(order.indexOf('schedule')).toBeLessThan(order.lastIndexOf('cancel'));
			expect(order[order.length - 1]).toBe('cancel');
		} finally {
			cancel.mockImplementation(() => Promise.resolve());
		}
	});

	it('resolves true when scheduled, false when denied or when schedule rejects', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		try {
			checkPermissions.mockResolvedValueOnce({ display: 'granted' });
			await expect(scheduleRestEnd(5_000)).resolves.toBe(true);
			checkPermissions.mockResolvedValueOnce({ display: 'denied' });
			await expect(scheduleRestEnd(5_000)).resolves.toBe(false);
			checkPermissions.mockResolvedValueOnce({ display: 'granted' });
			schedule.mockRejectedValueOnce(new Error('boom'));
			await expect(scheduleRestEnd(5_000)).resolves.toBe(false);
		} finally {
			warn.mockRestore();
		}
	});

	it('creates the rest channel once and schedules into it', async () => {
		checkPermissions.mockResolvedValue({ display: 'granted' });
		try {
			// fresh module: the channel is created once per app run, earlier tests already did
			vi.resetModules();
			const core = await import('@capacitor/core');
			vi.mocked(core.Capacitor.isNativePlatform).mockReturnValue(true);
			const fresh = await import('./native');
			await fresh.scheduleRestEnd(5_000);
			await fresh.scheduleRestEnd(6_000);
			expect(createChannel).toHaveBeenCalledTimes(1);
			expect(createChannel).toHaveBeenCalledWith({ id: 'rest', name: 'Rest timer', description: 'Tells you when your rest is over', importance: 4, visibility: 1, vibration: true });
			expect(schedule).toHaveBeenLastCalledWith({ notifications: [expect.objectContaining({ channelId: 'rest', isExactNotification: true })] });
		} finally {
			checkPermissions.mockImplementation(() => Promise.resolve({ display: 'prompt' }));
		}
	});

	it('schedules inexact when the exact-alarm setting is not granted', async () => {
		checkExact.mockResolvedValueOnce({ exact_alarm: 'denied' });
		await scheduleRestEnd(5_000);
		expect(schedule).toHaveBeenLastCalledWith({ notifications: [expect.objectContaining({ isExactNotification: false })] });
	});

	it('plugin failures are swallowed and logged', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		try {
			checkPermissions.mockResolvedValueOnce({ display: 'granted' });
			schedule.mockRejectedValueOnce(new Error('boom'));
			await expect(scheduleRestEnd(5_000)).resolves.toBe(false);
			expect(warn).toHaveBeenCalledTimes(1);

			keepAwakeOn.mockRejectedValueOnce(new Error('boom'));
			await expect(keepAwake(true)).resolves.toBeUndefined();
			expect(warn).toHaveBeenCalledTimes(2);

			// a failed op does not wedge the queue
			cancel.mockClear();
			await cancelRestEnd();
			expect(cancel).toHaveBeenCalledTimes(1);
		} finally {
			warn.mockRestore();
		}
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
