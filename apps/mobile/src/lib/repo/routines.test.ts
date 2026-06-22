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
vi.mock('$lib/sync', () => ({ syncNow: vi.fn(() => Promise.resolve({} as never)) }));

import { createRoutine, getRoutine, listRoutines, setRoutineFolder, updateRoutine } from './routines';

let n = 0;
beforeEach(() => {
	backing = new IdbSyncStore(`rt-${Date.now()}-${n++}`);
});

describe('createRoutine + getRoutine', () => {
	it('creates a routine with exercises and reads it back with defaults applied', async () => {
		const id = await createRoutine({
			title: 'Legs',
			notes: '',
			folder_id: null,
			exercises: [
				{ exercise_id: 'sq', rest_seconds: 90, sets: [{ set_type: 'normal', target_weight: 100, target_reps: 5 }] }
			]
		});

		const r = await getRoutine(id);
		expect(r).toMatchObject({ id, title: 'Legs', notes: '', folder_id: null });
		expect(r!.exercises[0]).toMatchObject({ exercise_id: 'sq', rest_seconds: 90 });
		expect(r!.exercises[0].sets[0]).toMatchObject({ set_type: 'normal', target_weight: 100, target_reps: 5 });
	});

	it('returns null for a missing routine', async () => {
		expect(await getRoutine('nope')).toBeNull();
	});
});

describe('listRoutines', () => {
	it('lists alphabetically by title, mapping folder + title', async () => {
		await createRoutine({ title: 'Zeta', notes: '', folder_id: 'f1', exercises: [] });
		await createRoutine({ title: 'Alpha', notes: '', folder_id: null, exercises: [] });

		const list = await listRoutines();
		expect(list.map((r) => r.title)).toEqual(['Alpha', 'Zeta']);
		expect(list.find((r) => r.title === 'Zeta')!.folder_id).toBe('f1');
	});
});

describe('setRoutineFolder', () => {
	it('moves a routine into a folder while preserving its contents', async () => {
		const id = await createRoutine({
			title: 'P',
			notes: 'keep',
			folder_id: null,
			exercises: [{ exercise_id: 'x', rest_seconds: 60, sets: [] }]
		});

		await setRoutineFolder(id, 'f9');

		const r = await getRoutine(id);
		expect(r!.folder_id).toBe('f9');
		expect(r!.notes).toBe('keep');
		expect(r!.exercises).toHaveLength(1);
	});

	it('is a no-op for a missing routine', async () => {
		await setRoutineFolder('ghost', 'f1');
		expect(await getRoutine('ghost')).toBeNull();
	});
});

describe('updateRoutine', () => {
	it('updates fields, preserves created_at, and keeps the folder when not specified', async () => {
		const id = await createRoutine({ title: 'Old', notes: '', folder_id: 'fa', exercises: [] });
		const before = (await backing.get('routine', id))!.data as { created_at: number };
		await new Promise((r) => setTimeout(r, 2));

		await updateRoutine(id, { title: 'New', notes: 'n', exercises: [] }); // folder_id omitted

		const after = (await backing.get('routine', id))!.data as { title: string; created_at: number; folder_id: string | null };
		expect(after.title).toBe('New');
		expect(after.created_at).toBe(before.created_at);
		expect(after.folder_id).toBe('fa');
	});

	it('clears the folder when folder_id is explicitly null', async () => {
		const id = await createRoutine({ title: 'X', notes: '', folder_id: 'fa', exercises: [] });
		await updateRoutine(id, { title: 'X', notes: '', folder_id: null, exercises: [] });
		expect((await getRoutine(id))!.folder_id).toBeNull();
	});
});
