// Case-insensitive match on name or primary muscle. Empty query = all.
// Shared by the Exercises library page and the add-exercise picker.
export function filterExercises<T extends { name: string; primary_muscle: string }>(
	list: T[],
	query: string
): T[] {
	const q = query.trim().toLowerCase();
	if (!q) return list;
	return list.filter(
		(e) => e.name.toLowerCase().includes(q) || e.primary_muscle.toLowerCase().includes(q)
	);
}

export interface MuscleGroup<T> {
	muscle: string;
	items: T[];
}

/**
 * Group a (filtered) list by primary muscle for the library page: groups sorted by
 * muscle name, case-insensitively (first-seen spelling wins), items keep their order.
 * Exercises without a muscle land in a trailing "Other" group.
 */
export function groupByMuscle<T extends { primary_muscle: string }>(list: T[]): MuscleGroup<T>[] {
	const groups = new Map<string, MuscleGroup<T>>();
	const other: T[] = [];
	for (const e of list) {
		const m = e.primary_muscle.trim();
		if (!m) {
			other.push(e);
			continue;
		}
		const key = m.toLowerCase();
		const g = groups.get(key);
		if (g) g.items.push(e);
		else groups.set(key, { muscle: m, items: [e] });
	}
	const out = [...groups.values()].sort((a, b) => a.muscle.localeCompare(b.muscle));
	if (other.length) out.push({ muscle: 'Other', items: other });
	return out;
}

/** A muted meta line from optional parts: "Chest · Barbell", empty parts dropped. */
export function metaLine(...parts: (string | null | undefined)[]): string {
	return parts
		.map((p) => (p ?? '').trim())
		.filter(Boolean)
		.join(' · ');
}
