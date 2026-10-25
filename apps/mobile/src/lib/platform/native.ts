import { Capacitor } from '@capacitor/core';

// The only module that touches Capacitor. On the web (and the PWA) every call is a
// no-op, so app code can call these unconditionally. Plugins are imported lazily
// and only on a real device.

const FORCE_NATIVE = 'granite.forceNative';

/** Running inside the native app. e2e builds can force it to exercise native-only UI. */
export function isNative(): boolean {
	if (Capacitor.isNativePlatform()) return true;
	if (import.meta.env.VITE_E2E !== '1') return false;
	try {
		return localStorage.getItem(FORCE_NATIVE) === '1';
	} catch {
		return false;
	}
}

const device = () => Capacitor.isNativePlatform();

const REST_NOTIFICATION_ID = 1;

// Notification operations run strictly in call order: a skip issued while a
// schedule is still awaiting permission must not be overtaken by that schedule.
let queue: Promise<void> = Promise.resolve();
function serial<T>(op: () => Promise<T>): Promise<T> {
	const result = queue.then(op, op);
	queue = result.then(() => undefined, () => undefined);
	return result;
}

// Android fixes a channel's importance once it exists on a device, so create it up front.
let channelReady: Promise<void> | null = null;

/**
 * Schedule the "rest over" notification at epoch-ms `at` (replaces a pending one).
 * Resolves true only when a native notification was actually scheduled, so the
 * caller can skip its own in-app alert; never rejects.
 */
export function scheduleRestEnd(at: number): Promise<boolean> {
	if (!device()) return Promise.resolve(false);
	return serial(async () => {
		try {
			const { LocalNotifications } = await import('@capacitor/local-notifications');
			let { display } = await LocalNotifications.checkPermissions();
			if (display === 'prompt' || display === 'prompt-with-rationale') {
				({ display } = await LocalNotifications.requestPermissions());
			}
			if (display !== 'granted') return false; // the in-app alert still fires while open
			try {
				channelReady ??= LocalNotifications.createChannel({
					id: 'rest',
					name: 'Rest timer',
					description: 'Tells you when your rest is over',
					importance: 4,
					visibility: 1,
					vibration: true
				});
				await channelReady;
			} catch (err) {
				channelReady = null; // retry on the next rest
				throw err;
			}
			// Without exact-alarm permission schedule() would open the Settings screen mid-workout.
			const exact = await LocalNotifications.checkExactNotificationSetting().then(
				(s) => s.exact_alarm === 'granted',
				() => false
			);
			await LocalNotifications.cancel({ notifications: [{ id: REST_NOTIFICATION_ID }] });
			await LocalNotifications.schedule({
				notifications: [
					{
						id: REST_NOTIFICATION_ID,
						title: 'Rest over',
						body: 'Time for your next set.',
						channelId: 'rest',
						schedule: { at: new Date(at), allowWhileIdle: true },
						isExactNotification: exact
					}
				]
			});
			return true;
		} catch (err) {
			console.warn('[native] scheduleRestEnd failed', err); // best-effort; the in-app timer still works
			return false;
		}
	});
}

/** Cancel a pending rest notification. */
export function cancelRestEnd(): Promise<void> {
	if (!device()) return Promise.resolve();
	return serial(async () => {
		try {
			const { LocalNotifications } = await import('@capacitor/local-notifications');
			await LocalNotifications.cancel({ notifications: [{ id: REST_NOTIFICATION_ID }] });
		} catch (err) {
			console.warn('[native] cancelRestEnd failed', err);
		}
	});
}

/** Keep the screen on (logger open) or let it sleep again. */
export async function keepAwake(on: boolean): Promise<void> {
	if (!device()) return;
	try {
		const { KeepAwake } = await import('@capacitor-community/keep-awake');
		await (on ? KeepAwake.keepAwake() : KeepAwake.allowSleep());
	} catch (err) {
		console.warn('[native] keepAwake failed', err);
	}
}
