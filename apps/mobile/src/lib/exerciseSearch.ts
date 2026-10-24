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
