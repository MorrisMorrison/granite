import 'fake-indexeddb/auto';

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Change } from '@granite/shared';

import { IdbSyncStore } from '$lib/local/idb-store';

let backing: IdbSyncStore;
vi.mock('$lib/local/store', () => ({
	localStore: {
		list: (e: string) => backing.list(e),
		localWrite: (c: Change) => backing.localWrite(c)
	}
}));
vi.mock('./exercises', () => ({
	listExercises: () =>
		Promise.resolve([
			{ id: 'sq', name: 'Squat', primary_muscle: 'Legs' },
			{ id: 'bn', name: 'Bench', primary_muscle: 'Chest' }
		])
}));

import { muscleSets, muscleSetsThisWeek, volumeTrend, recentPersonalRecords } from './analytics';

const DAY = 86400000;

const now = new Date(2026, 5, 24, 12).getTime();
let n = 0;
beforeEach(() => {
	backing = new IdbSyncStore(`an-${n++}-${Date.now()}`);
});

type Ex = { exercise_id: string; sets: { set_type: string; weight: number | null; reps: number | null }[] };
async function addWorkout(id: string, start: number, exercises: Ex[]) {
	await backing.localWrite({
		entity: 'workout',
		id,
		updated_at: start,
		deleted: false,
		data: { start_time: start, exercises }
	});
}

describe('repo/analytics', () => {
	it('muscleSetsThisWeek joins local workouts with the exercise library', async () => {
		await addWorkout('w1', now, [
			{
				exercise_id: 'sq',
				sets: [
					{ set_type: 'warmup', weight: 40, reps: 5 },
					{ set_type: 'normal', weight: 100, reps: 5 }
				]
			},
			{ exercise_id: 'bn', sets: [{ set_type: 'normal', weight: 80, reps: 5 }] }
		]);

		// Legs 1 + Chest 1 (warm-up excluded) → tie broken alphabetically.
		expect(await muscleSetsThisWeek(now)).toEqual([
			{ muscle: 'Chest', sets: 1 },
			{ muscle: 'Legs', sets: 1 }
		]);
	});

	it('muscleSets windows working sets over the last N weeks', async () => {
		await addWorkout('w1', now, [
			{ exercise_id: 'sq', sets: [{ set_type: 'normal', weight: 100, reps: 5 }] }
		]); // this week: 1 Legs
		await addWorkout('w2', now - 21 * DAY, [
			{ exercise_id: 'bn', sets: [{ set_type: 'normal', weight: 80, reps: 5 }] }
		]); // 3 weeks ago: 1 Chest

		expect(await muscleSets(1, now)).toEqual([{ muscle: 'Legs', sets: 1 }]);
		expect(await muscleSets(4, now)).toEqual([
			{ muscle: 'Chest', sets: 1 },
			{ muscle: 'Legs', sets: 1 }
		]); // tie broken alphabetically
	});

	it('volumeTrend sums weekly tonnage from local workouts', async () => {
		await addWorkout('w1', now, [
			{ exercise_id: 'sq', sets: [{ set_type: 'normal', weight: 100, reps: 5 }] }
		]);
		const res = await volumeTrend(now);
		expect(res[res.length - 1].volume).toBe(500);
	});

	it('recentPersonalRecords returns recent e1RM PRs with exercise names joined', async () => {
		await addWorkout('w1', now - 14 * DAY, [
			{ exercise_id: 'sq', sets: [{ set_type: 'normal', weight: 100, reps: 5 }] }
		]); // baseline
		await addWorkout('w2', now - 2 * DAY, [
			{ exercise_id: 'sq', sets: [{ set_type: 'normal', weight: 110, reps: 5 }] }
		]); // PR
		const res = await recentPersonalRecords();
		expect(res).toHaveLength(1);
		expect(res[0].exerciseName).toBe('Squat');
		expect(res[0].weight).toBe(110);
	});
});
