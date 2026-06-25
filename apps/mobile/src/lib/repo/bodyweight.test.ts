import 'fake-indexeddb/auto';

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Change } from '@granite/shared';

import { IdbSyncStore } from '$lib/local/idb-store';

let backing: IdbSyncStore;
vi.mock('$lib/local/store', () => ({
	localStore: {
		list: (e: string) => backing.list(e),
		get: (e: string, id: string) => backing.get(e, id),
		localWrite: (c: Change) => backing.localWrite(c)
	}
}));
vi.mock('$lib/sync', () => ({ syncNow: vi.fn(() => Promise.resolve({} as never)) }));

import { addBodyweight, deleteBodyweight, listBodyweight, nearestBodyweight } from './bodyweight';

let n = 0;
beforeEach(() => {
	backing = new IdbSyncStore(`bw-${n++}-${Date.now()}`);
});

describe('bodyweight repo', () => {
	it('adds and lists weigh-ins, most recent first', async () => {
		await addBodyweight(80, 1000);
		await addBodyweight(81, 3000);
		await addBodyweight(82, 2000);

		const list = await listBodyweight();
		expect(list.map((e) => e.weight)).toEqual([81, 82, 80]); // sorted by recorded_at desc
	});

	it('finds the weigh-in nearest a time', async () => {
		await addBodyweight(80, 1000);
		await addBodyweight(90, 9000);
		const near = await nearestBodyweight(2000);
		expect(near?.weight).toBe(80);
		expect((await nearestBodyweight(8000))?.weight).toBe(90);
		expect(await nearestBodyweight(0)).not.toBeNull();
	});

	it('returns null nearest when there are no entries', async () => {
		expect(await nearestBodyweight(Date.now())).toBeNull();
	});

	it('soft-deletes a weigh-in', async () => {
		const id = await addBodyweight(80, 1000);
		expect(await listBodyweight()).toHaveLength(1);
		await deleteBodyweight(id);
		expect(await listBodyweight()).toHaveLength(0);
	});
});
