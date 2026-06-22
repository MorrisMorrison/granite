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

import { createFolder, deleteFolder, listFolders, renameFolder } from './folders';
import { createRoutine, getRoutine } from './routines';

let n = 0;
beforeEach(() => {
	backing = new IdbSyncStore(`fd-${Date.now()}-${n++}`);
});

describe('createFolder + listFolders', () => {
	it('assigns incrementing order_index and lists in that order', async () => {
		await createFolder('B');
		await createFolder('A');

		const list = await listFolders();
		expect(list.map((f) => f.name)).toEqual(['B', 'A']);
		expect(list.map((f) => f.order_index)).toEqual([0, 1]);
	});

	it('trims the folder name', async () => {
		await createFolder('  Spaced  ');
		expect((await listFolders())[0].name).toBe('Spaced');
	});
});

describe('renameFolder', () => {
	it('renames while preserving order_index', async () => {
		const id = await createFolder('First');
		await createFolder('Second');

		await renameFolder(id, 'Renamed');

		const f = (await listFolders()).find((x) => x.id === id)!;
		expect(f.name).toBe('Renamed');
		expect(f.order_index).toBe(0);
	});

	it('no-ops for a missing folder', async () => {
		await renameFolder('nope', 'X');
		expect(await listFolders()).toHaveLength(0);
	});
});

describe('deleteFolder', () => {
	it('removes the folder and moves its routines to ungrouped', async () => {
		const fid = await createFolder('Strength');
		const rid = await createRoutine({ title: 'R', notes: '', folder_id: fid, exercises: [] });

		await deleteFolder(fid);

		expect(await listFolders()).toHaveLength(0);
		const r = await getRoutine(rid);
		expect(r).not.toBeNull();
		expect(r!.folder_id).toBeNull();
	});
});
