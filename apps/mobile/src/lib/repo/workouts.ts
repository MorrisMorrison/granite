import { localStore } from '$lib/local/store';

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
