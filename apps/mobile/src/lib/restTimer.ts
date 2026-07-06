// Wall-clock rest timer. Tracks an absolute end time (not a tick count) so it stays
// accurate while the phone is locked/backgrounded — recompute `remaining` on every
// tick and on resume rather than decrementing a counter that pauses with the app.

export interface RestTimer {
	/** Whole seconds left, floored at 0. */
	remaining(): number;
	/** Whether a rest period is currently running. */
	active(): boolean;
	/** Start (or restart) a rest period of `seconds`. */
	start(seconds: number): void;
	/** Shift the end time by `delta` seconds; remaining never drops below 0. */
	bump(delta: number): void;
	/** Stop and clear the current rest period. */
	stop(): void;
	/**
	 * Recompute against `now`. Returns true iff this call is the transition to
	 * expiry (was active, remaining just hit 0) — the caller fires the alert then.
	 */
	tick(now: number): boolean;
}

export function createRestTimer(): RestTimer {
	let endsAt = 0;
	let running = false;

	const remaining = (now = Date.now()) =>
		running ? Math.max(0, Math.ceil((endsAt - now) / 1000)) : 0;

	return {
		remaining: () => remaining(),
		active: () => running,
		start(seconds: number) {
			endsAt = Date.now() + seconds * 1000;
			running = true;
		},
		bump(delta: number) {
			if (!running) return;
			// Clamp so the end time never falls in the past (remaining ≥ 0).
			endsAt = Math.max(Date.now(), endsAt + delta * 1000);
		},
		stop() {
			running = false;
			endsAt = 0;
		},
		tick(now: number) {
			if (!running) return false;
			if (remaining(now) <= 0) {
				running = false;
				endsAt = 0;
				return true;
			}
			return false;
		}
	};
}
