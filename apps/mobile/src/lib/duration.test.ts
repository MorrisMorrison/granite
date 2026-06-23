import { describe, expect, it } from 'vitest';

import { joinDuration, splitDuration } from './duration';

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
