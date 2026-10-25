import { listExercises, refreshExerciseLibrary } from '#lib/repo/exercises.ts';

export type PickerExercise = { id: string; name: string; primary_muscle: string };

async function readLocal(): Promise<PickerExercise[]> {
	return (await listExercises()).map((e) => ({
		id: e.id,
		name: e.name,
		primary_muscle: e.primary_muscle
	}));
}

/**
 * The exercises for a picker. On a fresh account the post-sign-up library pull may not
 * have landed yet, so an empty local list triggers one refresh and a re-read. Offline-safe:
 * a failed refresh just keeps the empty list.
 */
export async function loadPickerLibrary(): Promise<PickerExercise[]> {
	const first = await readLocal();
	if (first.length > 0) return first;
	await refreshExerciseLibrary().catch(() => {});
	return readLocal();
}
