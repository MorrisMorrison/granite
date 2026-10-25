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

/** Schedule the "rest over" notification at epoch-ms `at` (replaces a pending one). */
export async function scheduleRestEnd(at: number): Promise<void> {
	if (!device()) return;
	void at;
}

/** Cancel a pending rest notification. */
export async function cancelRestEnd(): Promise<void> {
	if (!device()) return;
}

/** Keep the screen on (logger open) or let it sleep again. */
export async function keepAwake(on: boolean): Promise<void> {
	if (!device()) return;
	void on;
}
