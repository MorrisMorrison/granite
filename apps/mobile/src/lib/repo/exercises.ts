import { api } from '$lib/api/client';
import { localStore } from '$lib/local/store';
import type { Change } from '@granite/shared';

export interface ExerciseRow {
	id: string;
	name: string;
	exercise_type: string;
	primary_muscle: string;
	is_builtin: boolean;
}

/** Exercises (built-in + custom) from the local store, alphabetical. Works offline. */
export async function listExercises(): Promise<ExerciseRow[]> {
	const records = await localStore.list('exercise');
	return records
		.map((c) => {
			const d = c.data as Partial<ExerciseRow>;
			return {
				id: c.id,
				name: d.name ?? '',
				exercise_type: d.exercise_type ?? '',
				primary_muscle: d.primary_muscle ?? '',
				is_builtin: d.is_builtin ?? false
			};
		})
		.sort((a, b) => a.name.localeCompare(b.name));
}

/** One exercise by id from the local store. Offline-ok. */
export async function getExercise(id: string): Promise<ExerciseRow | null> {
	const rec = await localStore.get('exercise', id);
	if (!rec || rec.deleted) return null;
	const d = rec.data as Partial<ExerciseRow>;
	return {
		id,
		name: d.name ?? '',
		exercise_type: d.exercise_type ?? '',
		primary_muscle: d.primary_muscle ?? '',
		is_builtin: d.is_builtin ?? false
	};
}

/**
 * Pull the full exercise library (built-ins + custom) into the local store.
 * Built-ins are server-seeded and not part of per-user sync, so they're fetched
 * here; applyRemote's last-write-wins respects any pending local edits.
 */
export async function refreshExerciseLibrary(): Promise<void> {
	const { data, error } = await api().GET('/api/v1/exercises');
	if (error || !data) throw new Error('failed to refresh exercises');
	const changes: Change[] = (data.exercises ?? []).map((e) => ({
		entity: 'exercise',
		id: e.id,
		updated_at: e.updated_at,
		deleted: false,
		data: e
	}));
	await localStore.applyRemote(changes);
}
