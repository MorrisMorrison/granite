import { describe, expect, it } from 'vitest';

import {
	defaultBar,
	estimate1RM,
	platesPerSide,
	repTargets,
	roundToLoadable,
	warmupSets,
	warmupTargetSets
} from './calc';

describe('platesPerSide', () => {
	it('breaks a kg load down greedily, per side', () => {
		// 100kg on a 20kg bar → 40 per side → 25 + 15
		expect(platesPerSide(100, 20, 'kg').plates).toEqual([25, 15]);
	});

	it('flags weights below the bar', () => {
		expect(platesPerSide(15, 20, 'kg').belowBar).toBe(true);
	});

	it('reports leftover when not exactly loadable', () => {
		// 21kg → 0.5 per side, no plate that small → 0.5 leftover
		expect(platesPerSide(21, 20, 'kg').leftover).toBeCloseTo(0.5);
	});

	it('returns just the bar with no plates at bar weight', () => {
		expect(platesPerSide(20, 20, 'kg')).toMatchObject({ plates: [], leftover: 0, belowBar: false });
	});
});

describe('estimate1RM', () => {
	it('returns the weight itself at 1 rep', () => {
		expect(estimate1RM(100, 1)).toBe(100);
	});
	it('applies Epley above 1 rep', () => {
		expect(estimate1RM(100, 5)).toBeCloseTo(116.7, 1);
	});
	it('guards invalid input', () => {
		expect(estimate1RM(0, 5)).toBe(0);
		expect(estimate1RM(100, 0)).toBe(0);
	});
});

describe('repTargets', () => {
	it('inverts a 1RM into per-rep estimates (heavier reps = lighter weight)', () => {
		const t = repTargets(120);
		expect(t.find((x) => x.reps === 1)?.weight).toBe(120);
		expect(t.find((x) => x.reps === 10)?.weight).toBeLessThan(120);
	});
});

describe('roundToLoadable', () => {
	it('rounds to the nearest 2.5kg over the bar, and never below the bar', () => {
		expect(roundToLoadable(61, 'kg')).toBe(60);
		expect(roundToLoadable(15, 'kg')).toBe(20);
	});
	it('uses lb bar + increments', () => {
		expect(defaultBar('lb')).toBe(45);
		expect(roundToLoadable(103, 'lb')).toBe(105);
	});
});

describe('warmupSets', () => {
	it('ramps ascending and stays under the working weight, reps starting at 5', () => {
		const w = warmupSets(100, 'kg');
		expect(w.length).toBeGreaterThanOrEqual(3);
		expect(w[0].reps).toBe(5);
		expect(w.every((s) => s.weight < 100)).toBe(true);
		for (let i = 1; i < w.length; i++) expect(w[i].weight).toBeGreaterThan(w[i - 1].weight);
	});

	it('adds more sets for heavy loads so no gap exceeds 20kg', () => {
		const heavy = warmupSets(140, 'kg');
		const light = warmupSets(60, 'kg');
		expect(heavy.length).toBeGreaterThan(light.length);
		for (let i = 1; i < heavy.length; i++) {
			expect(heavy[i].weight - heavy[i - 1].weight).toBeLessThanOrEqual(20);
		}
	});

	it('keeps lb gaps within one plate pair (≤45lb)', () => {
		const w = warmupSets(315, 'lb');
		for (let i = 1; i < w.length; i++) {
			expect(w[i].weight - w[i - 1].weight).toBeLessThanOrEqual(45);
		}
	});

	it('returns nothing for a bar-or-lighter working weight', () => {
		expect(warmupSets(20, 'kg')).toEqual([]);
	});
});

describe('warmupTargetSets', () => {
	it('derives warm-up sets from the heaviest work set', () => {
		const work = [
			{ set_type: 'normal', target_weight: 100 },
			{ set_type: 'normal', target_weight: 140 }
		];
		const warm = warmupTargetSets(work, 'kg');
		expect(warm.length).toBeGreaterThan(0);
		expect(warm.every((w) => w.set_type === 'warmup')).toBe(true);
		// all warm-up weights are below the top work weight
		expect(warm.every((w) => w.target_weight < 140)).toBe(true);
	});

	it('ignores existing warm-up sets when finding the top', () => {
		const work = [
			{ set_type: 'warmup', target_weight: 200 },
			{ set_type: 'normal', target_weight: 60 }
		];
		const warm = warmupTargetSets(work, 'kg');
		expect(warm.every((w) => w.target_weight < 60)).toBe(true);
	});

	it('returns nothing when no work set has a weight', () => {
		expect(warmupTargetSets([{ set_type: 'normal', target_weight: null }], 'kg')).toEqual([]);
		expect(warmupTargetSets([], 'kg')).toEqual([]);
	});
});
