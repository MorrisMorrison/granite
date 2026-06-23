// Pure gym-math helpers (no storage/UI imports) — trivially unit-testable. The
// /tools screen is a thin layer over these.
import type { WeightUnit } from '$lib/stores/prefs.svelte';

// Loadable plates per side, largest first.
const PLATES: Record<WeightUnit, number[]> = {
	kg: [25, 20, 15, 10, 5, 2.5, 1.25],
	lb: [45, 35, 25, 10, 5, 2.5]
};
const BAR: Record<WeightUnit, number> = { kg: 20, lb: 45 };

/** The conventional bar weight for a unit (20 kg / 45 lb). */
export function defaultBar(unit: WeightUnit): number {
	return BAR[unit];
}

export interface PlateResult {
	plates: number[]; // per side, largest first
	leftover: number; // per-side weight that couldn't be made exactly (>0 = not exact)
	belowBar: boolean; // target is lighter than the bar
}

/** Greedy plate breakdown to load on EACH side to reach `total` on a `bar`-weight barbell. */
export function platesPerSide(total: number, bar: number, unit: WeightUnit): PlateResult {
	const perSide = (total - bar) / 2;
	if (perSide < 0) return { plates: [], leftover: 0, belowBar: true };
	let rem = perSide;
	const plates: number[] = [];
	for (const p of PLATES[unit]) {
		while (rem >= p - 1e-9) {
			plates.push(p);
			rem -= p;
		}
	}
	return { plates, leftover: Math.round(rem * 100) / 100, belowBar: false };
}

/** Epley estimated 1-rep max from a weight × reps set. */
export function estimate1RM(weight: number, reps: number): number {
	if (weight <= 0 || reps <= 0) return 0;
	if (reps === 1) return weight;
	return Math.round(weight * (1 + reps / 30) * 10) / 10;
}

/** Estimated weight for each rep target, derived from a 1RM (inverse Epley). */
export function repTargets(
	oneRm: number,
	reps: number[] = [1, 3, 5, 8, 10, 12]
): { reps: number; weight: number }[] {
	// Epley has a discontinuity at 1 rep; the 1RM is the 1-rep weight by definition.
	return reps.map((r) => ({
		reps: r,
		weight: r === 1 ? oneRm : Math.round((oneRm / (1 + r / 30)) * 10) / 10
	}));
}

/** Round a weight to the nearest loadable barbell total (bar + matched plate pairs). */
export function roundToLoadable(weight: number, unit: WeightUnit): number {
	const bar = BAR[unit];
	const inc = 2 * PLATES[unit][PLATES[unit].length - 1]; // smallest plate, both sides
	if (weight <= bar) return bar;
	return bar + Math.round((weight - bar) / inc) * inc;
}

export interface WarmupSet {
	pct: number;
	weight: number;
	reps: number;
}

/** A warm-up ramp toward a working weight, each rounded to a loadable weight. */
export function warmupSets(working: number, unit: WeightUnit): WarmupSet[] {
	const steps = [
		{ pct: 0.4, reps: 5 },
		{ pct: 0.6, reps: 3 },
		{ pct: 0.8, reps: 2 }
	];
	return steps.map((s) => ({
		pct: s.pct,
		reps: s.reps,
		weight: roundToLoadable(working * s.pct, unit)
	}));
}
