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

/** Schedule the "rest over" notification at epoch-ms `at` (replaces a pending one). */
export async function scheduleRestEnd(at: number): Promise<void> {
	if (!device()) return;
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
}

/** Cancel a pending rest notification. */
export async function cancelRestEnd(): Promise<void> {
	if (!device()) return;
	const { LocalNotifications } = await import('@capacitor/local-notifications');
	await LocalNotifications.cancel({ notifications: [{ id: REST_NOTIFICATION_ID }] });
}

/** Keep the screen on (logger open) or let it sleep again. */
export async function keepAwake(on: boolean): Promise<void> {
	if (!device()) return;
	const { KeepAwake } = await import('@capacitor-community/keep-awake');
	await (on ? KeepAwake.keepAwake() : KeepAwake.allowSleep());
}
