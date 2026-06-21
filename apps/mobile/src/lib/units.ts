import type { WeightUnit } from '$lib/stores/prefs.svelte';

const LB_PER_KG = 2.2046226218;

/** Convert a stored weight (always kg) into the user's display unit. */
export function kgToDisplay(kg: number | null, unit: WeightUnit): number | null {
	if (kg == null) return null;
	if (unit === 'lb') return Math.round(kg * LB_PER_KG * 100) / 100;
	return kg;
}

/** Convert a user-entered weight (in their unit) back to kg for storage. */
export function displayToKg(value: number | null, unit: WeightUnit): number | null {
	if (value == null) return null;
	if (unit === 'lb') return Math.round((value / LB_PER_KG) * 1000) / 1000;
	return value;
}
