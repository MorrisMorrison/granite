/**
 * Signal the end of a rest period: a haptic buzz (phone in your pocket) plus a
 * short beep (phone on the bench). Both are best-effort — silently ignored where
 * unsupported (desktop) or blocked (audio autoplay policy), so this never throws.
 */
export function restAlert(): void {
	try {
		navigator.vibrate?.([200, 100, 200]);
	} catch {
		/* vibration unsupported */
	}
	try {
		beep();
	} catch {
		/* audio unavailable / blocked */
	}
}

/* v8 ignore start -- Web Audio; not runnable under jsdom/node, exercised manually */
function beep(): void {
	if (typeof window === 'undefined') return;
	const Ctx =
		window.AudioContext ??
		(window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
	if (!Ctx) return;
	const ctx = new Ctx();
	const osc = ctx.createOscillator();
	const gain = ctx.createGain();
	osc.connect(gain);
	gain.connect(ctx.destination);
	osc.frequency.value = 880;
	gain.gain.value = 0.1;
	osc.start();
	osc.stop(ctx.currentTime + 0.2);
	osc.addEventListener('ended', () => void ctx.close());
}
/* v8 ignore stop */
