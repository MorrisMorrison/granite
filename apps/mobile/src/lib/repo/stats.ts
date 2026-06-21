import { localStore } from '$lib/local/store';
import { computeExerciseProgress, type ExerciseProgress } from '$lib/stats';

export type { ExerciseProgress, SessionStat } from '$lib/stats';

/** Progress + PRs for one exercise from the local store (offline-ok). */
export async function exerciseProgress(exerciseId: string): Promise<ExerciseProgress> {
	const records = await localStore.list('workout');
	return computeExerciseProgress(records, exerciseId);
}
