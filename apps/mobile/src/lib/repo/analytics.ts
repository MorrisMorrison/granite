import { localStore } from '$lib/local/store';
import { listExercises } from './exercises';
import {
	setsPerMuscleThisWeek,
	weeklyVolume,
	type AnalyticsWorkout,
	type MuscleSets,
	type WeeklyVolume
} from '$lib/analytics';

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

/** Working sets per muscle group this week (busiest first). */
export async function muscleSetsThisWeek(now = Date.now()): Promise<MuscleSets[]> {
	const [workouts, exs] = await Promise.all([workoutsForAnalytics(), listExercises()]);
	const muscle = new Map(exs.map((e) => [e.id, e.primary_muscle]));
	return setsPerMuscleThisWeek(workouts, (id) => muscle.get(id) ?? 'Other', now);
}

/** Working-set tonnage (kg) per week over the recent weeks (oldest first). */
export async function volumeTrend(now = Date.now()): Promise<WeeklyVolume[]> {
	return weeklyVolume(await workoutsForAnalytics(), now);
}
