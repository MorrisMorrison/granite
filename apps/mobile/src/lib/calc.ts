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

/**
 * Round a deloaded weight. For barbell-range weights (≥ bar) this is loadable
 * barbell math; for sub-bar weights (dumbbells, machines, light accessories) it
 * rounds to the small increment (2.5 kg / 5 lb) instead of flooring to the bar —
 * so a 12 kg dumbbell deloaded −10% lands near 10.5, not 20. Never below 0.
 */
export function roundDeload(weight: number, unit: WeightUnit): number {
	if (weight >= BAR[unit]) return roundToLoadable(weight, unit);
	const inc = 2 * PLATES[unit][PLATES[unit].length - 1]; // 2.5 kg / 5 lb
	return Math.max(0, Math.round(weight / inc) * inc);
}

export interface WarmupSet {
	pct: number;
	weight: number;
	reps: number;
}

/** A warm-up ramp toward a working weight, each rounded to a loadable weight. */
// Biggest jump allowed between consecutive warm-up sets (≈ one plate pair).
const WARMUP_MAX_GAP: Record<WeightUnit, number> = { kg: 20, lb: 45 };

/**
 * Warm-up ramp from ~40% to ~85% of the working weight, with reps stepping down
 * 5→1. The number of sets scales with the load: enough are inserted so no gap
 * between consecutive sets exceeds WARMUP_MAX_GAP — heavy lifts get more, smaller
 * jumps (e.g. 140kg → 5 sets instead of 3 big ones). All weights are loadable.
 */
export function warmupSets(working: number, unit: WeightUnit): WarmupSet[] {
	const bar = BAR[unit];
	if (working <= bar) return []; // nothing meaningful to ramp
	const first = Math.max(bar, roundToLoadable(working * 0.4, unit));
	const top = roundToLoadable(working * 0.85, unit);
	if (top <= first) return [{ pct: first / working, weight: first, reps: 5 }];

	const intervals = Math.max(1, Math.ceil((top - first) / WARMUP_MAX_GAP[unit]));
	const sets: WarmupSet[] = [];
	for (let i = 0; i <= intervals; i++) {
		const weight = roundToLoadable(first + ((top - first) * i) / intervals, unit);
		sets.push({ pct: Math.round((weight / working) * 100) / 100, weight, reps: Math.max(1, 5 - i) });
	}
	// Drop any consecutive duplicates rounding may produce on light loads.
	return sets.filter((s, i) => i === 0 || s.weight !== sets[i - 1].weight);
}

export interface WarmupTargetSet {
	set_type: 'warmup';
	target_weight: number;
	target_reps: number;
}

/**
 * Warm-up sets for a routine exercise, derived from its heaviest **work** set's
 * target weight (warm-up sets are ignored when finding the top). Empty if no work
 * set has a positive weight. Weights are in the same (display) unit as the inputs.
 */
export function warmupTargetSets(
	workSets: { set_type: string; target_weight: number | null }[],
	unit: WeightUnit
): WarmupTargetSet[] {
	const weights = workSets
		.filter((s) => s.set_type !== 'warmup')
		.map((s) => s.target_weight ?? 0);
	const top = weights.length ? Math.max(...weights) : 0;
	if (top <= 0) return [];
	return warmupSets(top, unit).map((w) => ({
		set_type: 'warmup',
		target_weight: w.weight,
		target_reps: w.reps
	}));
}
