import { localStore } from '$lib/local/store';
import { syncNow } from '$lib/sync';
import type { Change } from '@granite/shared';

export interface RoutineRow {
	id: string;
	title: string;
}

export interface RoutineSetTarget {
	set_type: string;
	target_weight: number | null;
	target_reps: number | null;
}
export interface RoutineExerciseDetail {
	exercise_id: string;
	rest_seconds: number;
	sets: RoutineSetTarget[];
}
export interface RoutineDetail {
	id: string;
	title: string;
	notes: string;
	exercises: RoutineExerciseDetail[];
}

/** Routines (title only) from the local store, alphabetical. Works offline. */
export async function listRoutines(): Promise<RoutineRow[]> {
	const records = await localStore.list('routine');
	return records
		.map((c) => ({ id: c.id, title: (c.data as { title?: string }).title ?? '' }))
		.sort((a, b) => a.title.localeCompare(b.title));
}

/** One routine (with its exercises + target sets) from the local store. Offline-ok. */
export async function getRoutine(id: string): Promise<RoutineDetail | null> {
	const rec = await localStore.get('routine', id);
	if (!rec || rec.deleted) return null;
	const d = rec.data as {
		title?: string;
		notes?: string;
		exercises?: {
			exercise_id: string;
			rest_seconds?: number;
			sets?: { set_type: string; target_weight?: number | null; target_reps?: number | null }[];
		}[];
	};
	return {
		id,
		title: d.title ?? '',
		notes: d.notes ?? '',
		exercises: (d.exercises ?? []).map((ex) => ({
			exercise_id: ex.exercise_id,
			rest_seconds: ex.rest_seconds ?? 0,
			sets: (ex.sets ?? []).map((s) => ({
				set_type: s.set_type,
				target_weight: s.target_weight ?? null,
				target_reps: s.target_reps ?? null
			}))
		}))
	};
}

export interface RoutineSetInput {
	set_type: string;
	target_weight?: number | null;
	target_reps?: number | null;
}
export interface RoutineExerciseInput {
	exercise_id: string;
	rest_seconds: number;
	sets: RoutineSetInput[];
}
export interface RoutineInput {
	title: string;
	notes: string;
	exercises: RoutineExerciseInput[];
}

/** Create a routine in the local store (works offline) and sync. Returns the id. */
export async function createRoutine(input: RoutineInput): Promise<string> {
	const now = Date.now();
	const id = crypto.randomUUID();
	await writeRoutine(id, now, now, null, 0, input);
	return id;
}

/** Update a routine in place, preserving created_at/folder/order. Works offline. */
export async function updateRoutine(id: string, input: RoutineInput): Promise<void> {
	const existing = await localStore.get('routine', id);
	const d = (existing?.data ?? {}) as {
		created_at?: number;
		folder_id?: string | null;
		order_index?: number;
	};
	await writeRoutine(id, Date.now(), d.created_at ?? Date.now(), d.folder_id ?? null, d.order_index ?? 0, input);
}

async function writeRoutine(
	id: string,
	updatedAt: number,
	createdAt: number,
	folderId: string | null,
	orderIndex: number,
	input: RoutineInput
): Promise<void> {
	const data = {
		folder_id: folderId,
		title: input.title,
		notes: input.notes,
		order_index: orderIndex,
		created_at: createdAt,
		exercises: input.exercises.map((ex, i) => ({
			id: crypto.randomUUID(),
			exercise_id: ex.exercise_id,
			order_index: i,
			notes: '',
			rest_seconds: ex.rest_seconds,
			superset_group: null,
			sets: ex.sets.map((s, j) => ({
				id: crypto.randomUUID(),
				order_index: j,
				set_type: s.set_type || 'normal',
				target_weight: s.target_weight ?? null,
				target_reps: s.target_reps ?? null,
				target_rpe: null,
				target_duration: null
			}))
		}))
	};
	const change: Change = { entity: 'routine', id, updated_at: updatedAt, deleted: false, data };
	await localStore.localWrite(change);
	void syncNow().catch(() => {}); // pushes online; queued in the outbox offline
}
