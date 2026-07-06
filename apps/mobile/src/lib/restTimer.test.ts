import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createRestTimer } from './restTimer';

describe('createRestTimer', () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	it('starts active with the full duration remaining', () => {
		const t = createRestTimer();
		t.start(90);
		expect(t.active()).toBe(true);
		expect(t.remaining()).toBe(90);
	});

	it('is wall-clock correct after a simulated suspension (longer than one tick)', () => {
		const t = createRestTimer();
		t.start(90);
		// Phone locked for 30s straight — no ticks ran, but wall clock advanced.
		vi.advanceTimersByTime(30_000);
		expect(t.remaining()).toBe(60);
	});

	it('tick returns true exactly on the expiry transition and stops', () => {
		const t = createRestTimer();
		t.start(10);
		expect(t.tick(Date.now())).toBe(false);
		vi.advanceTimersByTime(10_000);
		expect(t.tick(Date.now())).toBe(true); // fires the alert
		expect(t.active()).toBe(false);
		expect(t.remaining()).toBe(0);
		// no double-fire on the next tick
		expect(t.tick(Date.now())).toBe(false);
	});

	it('expires correctly even if the tick is skipped during suspension', () => {
		const t = createRestTimer();
		t.start(10);
		vi.advanceTimersByTime(25_000); // backgrounded well past the end
		expect(t.remaining()).toBe(0);
		expect(t.tick(Date.now())).toBe(true); // first tick after resume fires
	});

	it('bump adds/removes time and clamps remaining at 0', () => {
		const t = createRestTimer();
		t.start(30);
		t.bump(15);
		expect(t.remaining()).toBe(45);
		t.bump(-15);
		expect(t.remaining()).toBe(30);
		// over-subtract clamps at 0, never negative
		t.bump(-100);
		expect(t.remaining()).toBe(0);
	});

	it('stop clears the timer', () => {
		const t = createRestTimer();
		t.start(60);
		t.stop();
		expect(t.active()).toBe(false);
		expect(t.remaining()).toBe(0);
	});
});
