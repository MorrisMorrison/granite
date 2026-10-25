import { describe, expect, it } from 'vitest';

import { formatElapsed, formatRest, joinDuration, splitDuration, workoutMinutes } from './duration';

describe('splitDuration', () => {
	it('splits seconds into minutes + seconds', () => {
		expect(splitDuration(210)).toEqual({ min: 3, sec: 30 });
		expect(splitDuration(60)).toEqual({ min: 1, sec: 0 });
		expect(splitDuration(45)).toEqual({ min: 0, sec: 45 });
	});
	it('handles null/zero', () => {
		expect(splitDuration(null)).toEqual({ min: 0, sec: 0 });
		expect(splitDuration(0)).toEqual({ min: 0, sec: 0 });
	});
});

describe('joinDuration', () => {
	it('combines minutes + seconds into seconds', () => {
		expect(joinDuration(3, 30)).toBe(210);
		expect(joinDuration(1, 0)).toBe(60);
	});
	it('clamps seconds to 0..59 and floors negatives', () => {
		expect(joinDuration(1, 90)).toBe(119); // 60 + clamp(90→59)
		expect(joinDuration(-2, -5)).toBe(0);
	});
	it('round-trips with splitDuration', () => {
		for (const s of [0, 30, 60, 90, 210, 599]) {
			const { min, sec } = splitDuration(s);
			expect(joinDuration(min, sec)).toBe(s);
		}
	});
});

describe('formatElapsed', () => {
	it('formats mm:ss and h:mm:ss', () => {
		expect(formatElapsed(0)).toBe('00:00');
		expect(formatElapsed(61_000)).toBe('01:01');
		expect(formatElapsed(3_599_000)).toBe('59:59');
		expect(formatElapsed(3_661_000)).toBe('1:01:01');
		expect(formatElapsed(-5000)).toBe('00:00');
	});
});

describe('formatRest', () => {
	it('formats m:ss', () => {
		expect(formatRest(5)).toBe('0:05');
		expect(formatRest(90)).toBe('1:30');
		expect(formatRest(-3)).toBe('0:00');
	});
});

describe('workoutMinutes', () => {
	it('rounds the span to whole minutes', () => {
		expect(workoutMinutes(0, 58 * 60000)).toBe(58);
		expect(workoutMinutes(0, 90 * 1000)).toBe(2);
	});
	it('is null with no end or a span under half a minute', () => {
		expect(workoutMinutes(1000, null)).toBeNull();
		expect(workoutMinutes(1000, undefined)).toBeNull();
		expect(workoutMinutes(0, 20 * 1000)).toBeNull();
		expect(workoutMinutes(0, 40 * 1000)).toBe(1);
	});
});
