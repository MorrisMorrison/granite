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
const getMock = vi.fn();
vi.mock('$lib/api/client', () => ({ api: () => ({ GET: getMock }) }));

import { getExercise, listExercises, refreshExerciseLibrary } from './exercises';

let n = 0;
beforeEach(() => {
	backing = new IdbSyncStore(`ex-${Date.now()}-${n++}`);
	getMock.mockReset();
});

describe('refreshExerciseLibrary', () => {
	it('pulls the library from the API into the local store', async () => {
		getMock.mockResolvedValue({
			data: {
				exercises: [
					{ id: 'a', name: 'Squat', updated_at: 5, exercise_type: 'weight', primary_muscle: 'legs', is_builtin: true }
				]
			},
			error: undefined
		});

		await refreshExerciseLibrary();

		const list = await listExercises();
		expect(list.map((e) => e.name)).toEqual(['Squat']);
		expect(list[0].is_builtin).toBe(true);
	});

	it('throws when the request fails', async () => {
		getMock.mockResolvedValue({ data: undefined, error: { detail: 'boom' } });
		await expect(refreshExerciseLibrary()).rejects.toThrow();
	});
});

describe('listExercises + getExercise', () => {
	it('lists alphabetically and reads one by id with defaults', async () => {
		await backing.applyRemote([
			{ entity: 'exercise', id: 'z', updated_at: 1, deleted: false, data: { name: 'Zercher' } },
			{ entity: 'exercise', id: 'b', updated_at: 1, deleted: false, data: { name: 'Bench', primary_muscle: 'chest' } }
		]);

		const list = await listExercises();
		expect(list.map((e) => e.name)).toEqual(['Bench', 'Zercher']);

		const one = await getExercise('b');
		expect(one).toMatchObject({ id: 'b', name: 'Bench', primary_muscle: 'chest', exercise_type: '', is_builtin: false });
	});

	it('returns null for missing or deleted exercises', async () => {
		await backing.applyRemote([
			{ entity: 'exercise', id: 'd', updated_at: 1, deleted: true, data: { name: 'Gone' } }
		]);
		expect(await getExercise('d')).toBeNull();
		expect(await getExercise('absent')).toBeNull();
	});
});
