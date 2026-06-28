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
vi.mock('$lib/sync', () => ({ syncNow: () => Promise.resolve() }));

import {
	getExercise,
	listExercises,
	refreshExerciseLibrary,
	createExercise,
	updateExercise,
	archiveExercise
} from './exercises';

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

describe('custom exercise CRUD', () => {
	it('creates a custom exercise (non-builtin, not archived) that lists', async () => {
		const id = await createExercise({
			name: 'Cable Fly',
			exercise_type: 'weight_reps',
			primary_muscle: 'Chest',
			equipment: 'Cable'
		});
		expect(await getExercise(id)).toMatchObject({
			name: 'Cable Fly',
			exercise_type: 'weight_reps',
			primary_muscle: 'Chest',
			equipment: 'Cable',
			is_builtin: false,
			is_archived: false
		});
		expect((await listExercises()).map((e) => e.name)).toContain('Cable Fly');
	});

	it('updates a custom exercise, merging fields', async () => {
		const id = await createExercise({ name: 'Fly', exercise_type: 'weight_reps', primary_muscle: 'Chest' });
		await updateExercise(id, {
			name: 'Pec Fly',
			exercise_type: 'reps_only',
			primary_muscle: 'Chest',
			equipment: 'Machine'
		});
		expect(await getExercise(id)).toMatchObject({
			name: 'Pec Fly',
			exercise_type: 'reps_only',
			equipment: 'Machine'
		});
	});

	it('archives a custom exercise: hidden from the list but still readable by id', async () => {
		const id = await createExercise({ name: 'Mistake', exercise_type: 'weight_reps', primary_muscle: 'Chest' });
		await archiveExercise(id);
		expect((await listExercises()).map((e) => e.name)).not.toContain('Mistake');
		expect((await getExercise(id))?.is_archived).toBe(true); // history still resolves it
	});

	it('update/archive are no-ops for a missing id', async () => {
		await updateExercise('absent', { name: 'x', exercise_type: 'weight_reps', primary_muscle: 'Chest' });
		await archiveExercise('absent');
		expect(await getExercise('absent')).toBeNull();
	});
});
