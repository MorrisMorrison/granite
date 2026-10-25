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
function serial(op: () => Promise<void>): Promise<void> {
	queue = queue.then(op, op);
	return queue;
}

/** Schedule the "rest over" notification at epoch-ms `at` (replaces a pending one). */
export function scheduleRestEnd(at: number): Promise<void> {
	if (!device()) return Promise.resolve();
	return serial(async () => {
		try {
			const { LocalNotifications } = await import('@capacitor/local-notifications');
			let { display } = await LocalNotifications.checkPermissions();
			if (display === 'prompt' || display === 'prompt-with-rationale') {
				({ display } = await LocalNotifications.requestPermissions());
			}
			if (display !== 'granted') return; // the in-app alert still fires while open
			await LocalNotifications.cancel({ notifications: [{ id: REST_NOTIFICATION_ID }] });
			await LocalNotifications.schedule({
				notifications: [
					{
						id: REST_NOTIFICATION_ID,
						title: 'Rest over',
						body: 'Time for your next set.',
						schedule: { at: new Date(at), allowWhileIdle: true }
					}
				]
			});
		} catch (err) {
			console.warn('[native] scheduleRestEnd failed', err); // best-effort; the in-app timer still works
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
