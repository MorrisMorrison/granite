import 'fake-indexeddb/auto';

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Change } from '@granite/shared';

import { IdbSyncStore } from '$lib/local/idb-store';

let backing: IdbSyncStore;
vi.mock('$lib/local/store', () => ({
	localStore: {
		list: (e: string) => backing.list(e),
		get: (e: string, id: string) => backing.get(e, id),
		localWrite: (c: Change) => backing.localWrite(c),
		applyRemote: (c: Change[]) => backing.applyRemote(c)
	}
}));

import { exerciseProgress, lastPerformance } from './stats';

const workout = (id: string, start: number, weight: number, reps: number): Change => ({
	entity: 'workout',
	id,
	updated_at: start,
	deleted: false,
	data: {
		start_time: start,
		end_time: start + 1,
		exercises: [
			{ exercise_id: 'ex1', sets: [{ set_type: 'normal', weight, reps, is_completed: true }] }
		]
	}
});

let n = 0;
beforeEach(() => {
	backing = new IdbSyncStore(`st-${Date.now()}-${n++}`);
});

describe('exerciseProgress', () => {
	it('aggregates PRs and sessions from local workouts', async () => {
		await backing.localWrite(workout('w1', 100, 60, 5));
		await backing.localWrite(workout('w2', 200, 80, 5));

		const prog = await exerciseProgress('ex1');
		expect(prog.total_sessions).toBe(2);
		expect(prog.pr_weight).toBe(80);
		expect(prog.sessions.map((s) => s.workout_id)).toEqual(['w1', 'w2']); // chronological
	});

	it('returns an empty progress when the exercise has no history', async () => {
		const prog = await exerciseProgress('none');
		expect(prog.total_sessions).toBe(0);
		expect(prog.pr_weight).toBeNull();
	});
});

describe('lastPerformance', () => {
	it('returns the most recent prior session sets', async () => {
		await backing.localWrite(workout('w1', 100, 60, 5));
		await backing.localWrite(workout('w2', 200, 80, 5));

		const last = await lastPerformance('ex1');
		expect(last?.date).toBe(200);
		expect(last?.sets[0]).toMatchObject({ weight: 80, reps: 5 });
	});

	it('returns null with no history', async () => {
		expect(await lastPerformance('none')).toBeNull();
	});
});
