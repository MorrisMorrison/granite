import { localStore } from '$lib/local/store';
import { syncNow } from '$lib/sync';
import type { Change } from '@granite/shared';
import { listExercises } from './exercises';

export interface WorkoutSummary {
	id: string;
	title: string;
	start_time: number;
	end_time: number | null;
}

/** Logged workouts from the local store, most recent first (works offline). */
export async function listWorkouts(): Promise<WorkoutSummary[]> {
	const records = await localStore.list('workout');
	return records
		.map((c) => {
			const d = c.data as { title?: string; start_time?: number; end_time?: number | null };
			return {
				id: c.id,
				title: d.title ?? '',
				start_time: d.start_time ?? 0,
				end_time: d.end_time ?? null
			};
		})
		.sort((a, b) => b.start_time - a.start_time);
}

export interface WorkoutSetDetail {
	set_type: string;
	weight: number | null; // kg, as stored
	reps: number | null;
	is_completed: boolean;
}
export interface WorkoutExerciseDetail {
	exercise_id: string;
	name: string;
	sets: WorkoutSetDetail[];
}
export interface WorkoutDetail {
	id: string;
	title: string;
	notes: string;
	start_time: number;
	end_time: number | null;
	exercises: WorkoutExerciseDetail[];
}

/** One logged workout (with its exercises + sets) from the local store, exercise
 *  names joined from the local library. Null if missing/deleted. Offline-ok. */
export async function getWorkout(id: string): Promise<WorkoutDetail | null> {
	const rec = await localStore.get('workout', id);
	if (!rec || rec.deleted) return null;
	const lib = await listExercises();
	const nameOf = (exId: string) => lib.find((e) => e.id === exId)?.name ?? 'Exercise';
	const d = rec.data as {
		title?: string;
		notes?: string;
		start_time?: number;
		end_time?: number | null;
		exercises?: {
			exercise_id: string;
			sets?: { set_type?: string; weight?: number | null; reps?: number | null; is_completed?: boolean }[];
		}[];
	};
	return {
		id,
		title: d.title ?? '',
		notes: d.notes ?? '',
		start_time: d.start_time ?? 0,
		end_time: d.end_time ?? null,
		exercises: (d.exercises ?? []).map((ex) => ({
			exercise_id: ex.exercise_id,
			name: nameOf(ex.exercise_id),
			sets: (ex.sets ?? []).map((s) => ({
				set_type: s.set_type ?? 'normal',
				weight: s.weight ?? null,
				reps: s.reps ?? null,
				is_completed: s.is_completed ?? false
			}))
		}))
	};
}

export interface LogSetInput {
	set_type: string;
	weight: number | null;
	reps: number | null;
	is_completed: boolean;
}
export interface LogExerciseInput {
	exercise_id: string;
	sets: LogSetInput[];
}
export interface LogWorkoutInput {
	title?: string;
	routine_id?: string | null;
	start_time: number;
	end_time: number | null;
	exercises: LogExerciseInput[];
}

/**
 * Save a logged workout to the local store (works offline) and trigger a sync.
 * The record is built in the server's sync shape — client-generated UUIDs for the
 * workout and each exercise/set, order_index, created_at — so the sync push applies
 * cleanly. Offline, it sits in the outbox and pushes on reconnect. Returns the id.
 */
export async function logWorkout(input: LogWorkoutInput): Promise<string> {
	const now = Date.now();
	const id = crypto.randomUUID();
	const data = {
		routine_id: input.routine_id ?? null,
		title: input.title ?? '',
		notes: '',
		start_time: input.start_time,
		end_time: input.end_time,
		created_at: now,
		exercises: input.exercises.map((ex, i) => ({
			id: crypto.randomUUID(),
			exercise_id: ex.exercise_id,
			order_index: i,
			notes: '',
			superset_group: null,
			sets: ex.sets.map((s, j) => ({
				id: crypto.randomUUID(),
				order_index: j,
				set_type: s.set_type || 'normal',
				weight: s.weight,
				reps: s.reps,
				rpe: null,
				duration: null,
				distance: null,
				is_completed: s.is_completed
			}))
		}))
	};
	const change: Change = { entity: 'workout', id, updated_at: now, deleted: false, data };
	await localStore.localWrite(change);
	void syncNow().catch(() => {}); // pushes online; stays queued in the outbox offline
	return id;
}
