import 'fake-indexeddb/auto';

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Change } from '@granite/shared';

import { IdbSyncStore } from '$lib/local/idb-store';

// Each test runs against a fresh IndexedDB-backed store (unique name), with the
// fire-and-forget sync stubbed out — we're testing local read/write shaping.
let backing: IdbSyncStore;
vi.mock('$lib/local/store', () => ({
	localStore: {
		list: (e: string) => backing.list(e),
		get: (e: string, id: string) => backing.get(e, id),
		localWrite: (c: Change) => backing.localWrite(c),
		applyRemote: (c: Change[]) => backing.applyRemote(c)
	}
}));
const { syncNow } = vi.hoisted(() => ({ syncNow: vi.fn(() => Promise.resolve()) }));
vi.mock('$lib/sync', () => ({ syncNow }));

import { listWorkouts, logWorkout } from './workouts';

let n = 0;
beforeEach(() => {
	backing = new IdbSyncStore(`wk-${Date.now()}-${n++}`);
	syncNow.mockClear();
});

describe('logWorkout', () => {
	it('saves a workout in sync shape, returns its id, and triggers a sync', async () => {
		const id = await logWorkout({
			title: 'Push',
			start_time: 1000,
			end_time: 2000,
			exercises: [
				{
					exercise_id: 'ex1',
					sets: [{ set_type: 'normal', weight: 60, reps: 5, is_completed: true }]
				}
			]
		});

		expect(id).toBeTruthy();
		const rec = await backing.get('workout', id);
		expect(rec?.deleted).toBe(false);
		const d = rec!.data as { title: string; exercises: { exercise_id: string; order_index: number; sets: unknown[] }[] };
		expect(d.title).toBe('Push');
		expect(d.exercises[0]).toMatchObject({ exercise_id: 'ex1', order_index: 0 });
		expect(d.exercises[0].sets[0]).toMatchObject({
			weight: 60,
			reps: 5,
			set_type: 'normal',
			is_completed: true,
			order_index: 0
		});
		expect(syncNow).toHaveBeenCalledOnce();
	});

	it('defaults a blank set_type to "normal" and queues the change to the outbox', async () => {
		const id = await logWorkout({
			start_time: 1,
			end_time: null,
			exercises: [{ exercise_id: 'e', sets: [{ set_type: '', weight: null, reps: null, is_completed: false }] }]
		});

		const d = (await backing.get('workout', id))!.data as { exercises: { sets: { set_type: string }[] }[] };
		expect(d.exercises[0].sets[0].set_type).toBe('normal');
		const pending = await backing.getPending();
		expect(pending.map((c) => c.id)).toContain(id);
	});
});

describe('listWorkouts', () => {
	it('returns workouts newest-first with mapped summary fields', async () => {
		await logWorkout({ title: 'A', start_time: 100, end_time: 200, exercises: [] });
		await logWorkout({ title: 'B', start_time: 300, end_time: null, exercises: [] });

		const list = await listWorkouts();
		expect(list.map((w) => w.title)).toEqual(['B', 'A']);
		expect(list[0]).toMatchObject({ title: 'B', start_time: 300, end_time: null });
	});

	it('is empty with no workouts logged', async () => {
		expect(await listWorkouts()).toEqual([]);
	});
});
