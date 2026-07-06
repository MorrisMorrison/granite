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

import {
	muscleSets,
	volumeTrend,
	recentPersonalRecords,
	allTimeRecordsBoard,
	topLiftsTrend
} from './analytics';

const DAY = 86400000;

const now = new Date(2026, 5, 24, 12).getTime();
let n = 0;
beforeEach(() => {
	backing = new IdbSyncStore(`an-${n++}-${Date.now()}`);
});

type Ex = {
	exercise_id: string;
	sets: { set_type: string; weight: number | null; reps: number | null; is_completed?: boolean }[];
};
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
	it('muscleSets(1) joins local workouts with the exercise library', async () => {
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
		expect(await muscleSets(1, now)).toEqual([
			{ muscle: 'Chest', sets: 1 },
			{ muscle: 'Legs', sets: 1 }
		]);
	});

	// Lock-in: the shared predicate is completed AND not-warmup. An unchecked
	// (prefilled-but-skipped) working set and a completed warm-up must both be
	// invisible to every analytic — no phantom volume, PRs, records, or set counts.
	it('excludes unchecked working sets and completed warm-ups everywhere', async () => {
		await addWorkout('base', now - 14 * DAY, [
			{ exercise_id: 'sq', sets: [{ set_type: 'normal', weight: 100, reps: 5, is_completed: true }] }
		]); // baseline so a later e1RM jump would register as a PR if it counted
		await addWorkout('w1', now, [
			{
				exercise_id: 'sq',
				sets: [
					{ set_type: 'warmup', weight: 200, reps: 5, is_completed: true }, // completed warm-up → excluded
					{ set_type: 'normal', weight: 300, reps: 5, is_completed: false }, // unchecked → excluded
					{ set_type: 'normal', weight: 100, reps: 5, is_completed: true } // the only real working set
				]
			}
		]);

		// Volume this week: only the 100×5 = 500 working set (not warm-up 200×5, not skipped 300×5).
		const vol = await volumeTrend(now);
		expect(vol[vol.length - 1].volume).toBe(500);

		// Sets per muscle this week: exactly 1 Legs set, not 3.
		expect(await muscleSets(1, now)).toEqual([{ muscle: 'Legs', sets: 1 }]);

		// No PR: the phantom 300×5 / warm-up 200×5 would have beaten the 100×5 baseline,
		// but neither counts, so the 100×5 repeat is no improvement.
		expect(await recentPersonalRecords()).toEqual([]);

		// All-time best stays the legit 100×5, never the excluded 200/300 sets.
		const board = await allTimeRecordsBoard();
		const sq = board.find((r) => r.exerciseName === 'Squat');
		expect(sq).toMatchObject({ weight: 100, reps: 5 });
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

	it('allTimeRecordsBoard returns the best e1RM per exercise with names, strongest first', async () => {
		await addWorkout('w1', now - 14 * DAY, [
			{ exercise_id: 'sq', sets: [{ set_type: 'normal', weight: 100, reps: 5 }] }
		]);
		await addWorkout('w2', now, [
			{ exercise_id: 'sq', sets: [{ set_type: 'normal', weight: 120, reps: 5 }] }, // new best
			{ exercise_id: 'bn', sets: [{ set_type: 'normal', weight: 80, reps: 5 }] },
			{ exercise_id: 'zz', sets: [{ set_type: 'normal', weight: 200, reps: 5 }] } // not in library
		]);

		const res = await allTimeRecordsBoard();
		// Strongest first; an exercise missing from the library falls back to "Exercise".
		expect(res.map((r) => r.exerciseName)).toEqual(['Exercise', 'Squat', 'Bench']);
		expect(res[1].weight).toBe(120);
	});

	it('topLiftsTrend returns most-trained lifts with names (unknown → fallback) and an e1RM series', async () => {
		await addWorkout('w1', now - 7 * DAY, [
			{ exercise_id: 'sq', sets: [{ set_type: 'normal', weight: 100, reps: 5 }] },
			{ exercise_id: 'zz', sets: [{ set_type: 'normal', weight: 200, reps: 5 }] } // not in library
		]);
		await addWorkout('w2', now, [
			{ exercise_id: 'sq', sets: [{ set_type: 'normal', weight: 110, reps: 5 }] },
			{ exercise_id: 'zz', sets: [{ set_type: 'normal', weight: 210, reps: 5 }] }
		]);

		const res = await topLiftsTrend();
		expect(res).toHaveLength(2);
		expect(res.map((l) => l.exerciseName)).toContain('Squat');
		expect(res.map((l) => l.exerciseName)).toContain('Exercise'); // zz falls back
		expect(res[0].sessions).toBe(2);
		expect(res[0].e1rmSeries).toHaveLength(2);
	});
});
