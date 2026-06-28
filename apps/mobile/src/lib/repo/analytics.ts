import { localStore } from '$lib/local/store';
import { listExercises } from './exercises';
import {
	setsPerMuscle,
	weeklyVolume,
	recentPRs,
	allTimeRecords,
	type AnalyticsWorkout,
	type MuscleSets,
	type WeeklyVolume,
	type PersonalRecord,
	type AllTimeRecord
} from '$lib/analytics';

export interface PersonalRecordRow extends PersonalRecord {
	exerciseName: string;
}
export interface AllTimeRecordRow extends AllTimeRecord {
	exerciseName: string;
}

async function workoutsForAnalytics(): Promise<AnalyticsWorkout[]> {
	const records = await localStore.list('workout');
	return records.map((c) => {
		const d = c.data as {
			start_time?: number;
			exercises?: {
				exercise_id?: string;
				sets?: { set_type?: string; weight?: number | null; reps?: number | null }[];
			}[];
		};
		return {
			start_time: d.start_time ?? 0,
			exercises: (d.exercises ?? []).map((e) => ({
				exercise_id: e.exercise_id ?? '',
				sets: (e.sets ?? []).map((s) => ({
					set_type: s.set_type ?? 'normal',
					weight: s.weight ?? null,
					reps: s.reps ?? null
				}))
			}))
		};
	});
}

/** Working sets per muscle group over the last `weeks` weeks (busiest first). */
export async function muscleSets(weeks: number, now = Date.now()): Promise<MuscleSets[]> {
	const [workouts, exs] = await Promise.all([workoutsForAnalytics(), listExercises()]);
	const muscle = new Map(exs.map((e) => [e.id, e.primary_muscle]));
	return setsPerMuscle(workouts, (id) => muscle.get(id) ?? 'Other', now, weeks);
}

/** Working sets per muscle group this week (busiest first). */
export async function muscleSetsThisWeek(now = Date.now()): Promise<MuscleSets[]> {
	return muscleSets(1, now);
}

/** Working-set tonnage (kg) per week over the recent weeks (oldest first). */
export async function volumeTrend(now = Date.now()): Promise<WeeklyVolume[]> {
	return weeklyVolume(await workoutsForAnalytics(), now);
}

/** Most recent estimated-1RM PRs across all exercises, with names joined in. */
export async function recentPersonalRecords(limit = 5): Promise<PersonalRecordRow[]> {
	const [workouts, exs] = await Promise.all([workoutsForAnalytics(), listExercises()]);
	const name = new Map(exs.map((e) => [e.id, e.name]));
	return recentPRs(workouts, limit).map((pr) => ({
		...pr,
		exerciseName: name.get(pr.exerciseId) ?? 'Exercise'
	}));
}

/** Best estimated-1RM per exercise (strongest first), with exercise names joined in. */
export async function allTimeRecordsBoard(limit = 10): Promise<AllTimeRecordRow[]> {
	const [workouts, exs] = await Promise.all([workoutsForAnalytics(), listExercises()]);
	const name = new Map(exs.map((e) => [e.id, e.name]));
	return allTimeRecords(workouts, limit).map((r) => ({
		...r,
		exerciseName: name.get(r.exerciseId) ?? 'Exercise'
	}));
}
