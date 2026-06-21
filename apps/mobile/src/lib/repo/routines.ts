import { localStore } from '$lib/local/store';

export interface RoutineSetTarget {
	set_type: string;
	target_weight: number | null;
	target_reps: number | null;
}
export interface RoutineExerciseDetail {
	exercise_id: string;
	sets: RoutineSetTarget[];
}
export interface RoutineDetail {
	id: string;
	title: string;
	exercises: RoutineExerciseDetail[];
}

/** Read one routine (with its target sets) from the local store. Works offline. */
export async function getRoutine(id: string): Promise<RoutineDetail | null> {
	const rec = await localStore.get('routine', id);
	if (!rec || rec.deleted) return null;
	const d = rec.data as {
		title?: string;
		exercises?: {
			exercise_id: string;
			sets?: { set_type: string; target_weight?: number | null; target_reps?: number | null }[];
		}[];
	};
	return {
		id,
		title: d.title ?? '',
		exercises: (d.exercises ?? []).map((ex) => ({
			exercise_id: ex.exercise_id,
			sets: (ex.sets ?? []).map((s) => ({
				set_type: s.set_type,
				target_weight: s.target_weight ?? null,
				target_reps: s.target_reps ?? null
			}))
		}))
	};
}
