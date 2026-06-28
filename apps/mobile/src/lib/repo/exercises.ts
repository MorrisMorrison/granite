import { api } from '$lib/api/client';
import { localStore } from '$lib/local/store';
import { syncNow } from '$lib/sync';
import type { Change } from '@granite/shared';

export interface ExerciseRow {
	id: string;
	name: string;
	exercise_type: string;
	primary_muscle: string;
	equipment: string;
	is_builtin: boolean;
	is_archived: boolean;
}

/** Fields for creating/editing a custom exercise. */
export interface ExerciseInput {
	name: string;
	exercise_type: string;
	primary_muscle: string;
	equipment?: string;
}

function toRow(id: string, d: Partial<ExerciseRow>): ExerciseRow {
	return {
		id,
		name: d.name ?? '',
		exercise_type: d.exercise_type ?? '',
		primary_muscle: d.primary_muscle ?? '',
		equipment: d.equipment ?? '',
		is_builtin: d.is_builtin ?? false,
		is_archived: d.is_archived ?? false
	};
}

/** Exercises (built-in + custom) from the local store, alphabetical, archived hidden.
 *  Works offline. */
export async function listExercises(): Promise<ExerciseRow[]> {
	const records = await localStore.list('exercise');
	return records
		.map((c) => toRow(c.id, c.data as Partial<ExerciseRow>))
		.filter((e) => !e.is_archived)
		.sort((a, b) => a.name.localeCompare(b.name));
}

/** One exercise by id from the local store (incl. archived, so history resolves). */
export async function getExercise(id: string): Promise<ExerciseRow | null> {
	const rec = await localStore.get('exercise', id);
	if (!rec || rec.deleted) return null;
	return toRow(id, rec.data as Partial<ExerciseRow>);
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

/** Create a custom exercise (saved locally + synced; the server stamps user_id). */
export async function createExercise(input: ExerciseInput): Promise<string> {
	const now = Date.now();
	const id = crypto.randomUUID();
	await localStore.localWrite({
		entity: 'exercise',
		id,
		updated_at: now,
		deleted: false,
		data: {
			name: input.name.trim(),
			exercise_type: input.exercise_type,
			primary_muscle: input.primary_muscle.trim(),
			secondary_muscles: [],
			equipment: input.equipment?.trim() ?? '',
			instructions: '',
			is_archived: false,
			is_builtin: false,
			created_at: now
		}
	});
	void syncNow().catch(() => {});
	return id;
}

/** Edit a custom exercise's fields (merges over the existing record). */
export async function updateExercise(id: string, input: ExerciseInput): Promise<void> {
	const rec = await localStore.get('exercise', id);
	if (!rec) return;
	await localStore.localWrite({
		entity: 'exercise',
		id,
		updated_at: Date.now(),
		deleted: false,
		data: {
			...(rec.data as object),
			name: input.name.trim(),
			exercise_type: input.exercise_type,
			primary_muscle: input.primary_muscle.trim(),
			equipment: input.equipment?.trim() ?? ''
		}
	});
	void syncNow().catch(() => {});
}

/** Archive a custom exercise: hides it from the library/picker but keeps history
 *  intact (no hard delete). */
export async function archiveExercise(id: string): Promise<void> {
	const rec = await localStore.get('exercise', id);
	if (!rec) return;
	await localStore.localWrite({
		entity: 'exercise',
		id,
		updated_at: Date.now(),
		deleted: false,
		data: { ...(rec.data as object), is_archived: true }
	});
	void syncNow().catch(() => {});
}
