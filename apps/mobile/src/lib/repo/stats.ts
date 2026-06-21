import { localStore } from '$lib/local/store';
import {
	computeExerciseProgress,
	computeLastPerformance,
	type ExerciseProgress,
	type LastPerformance
} from '$lib/stats';

export type { ExerciseProgress, SessionStat, LastPerformance } from '$lib/stats';

/** Progress + PRs for one exercise from the local store (offline-ok). */
export async function exerciseProgress(exerciseId: string): Promise<ExerciseProgress> {
	const records = await localStore.list('workout');
	return computeExerciseProgress(records, exerciseId);
}

/** The most recent prior performance of an exercise (for "previous" hints). Offline-ok. */
export async function lastPerformance(exerciseId: string): Promise<LastPerformance | null> {
	const records = await localStore.list('workout');
	return computeLastPerformance(records, exerciseId);
}
