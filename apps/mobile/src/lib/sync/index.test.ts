import { beforeEach, describe, expect, it, vi } from 'vitest';

// syncNow wires the shared sync engine to the app's store + API client. We mock
// those collaborators and assert the deduping behaviour syncNow adds on top.
const { syncFn, createSyncApi } = vi.hoisted(() => ({
	syncFn: vi.fn(),
	createSyncApi: vi.fn(() => ({}))
}));
vi.mock('@granite/shared', () => ({ sync: syncFn, createSyncApi }));
vi.mock('$lib/api/client', () => ({ api: vi.fn(() => ({})) }));
vi.mock('$lib/local/store', () => ({ localStore: {} }));

import { syncNow } from './index';

beforeEach(() => syncFn.mockReset());

describe('syncNow', () => {
	it('dedupes concurrent calls into a single sync cycle', async () => {
		let resolve!: (v: unknown) => void;
		syncFn.mockReturnValue(new Promise((r) => (resolve = r)));

		const p1 = syncNow();
		const p2 = syncNow();

		expect(p1).toBe(p2);
		expect(syncFn).toHaveBeenCalledOnce();

		resolve({ pushed: 0, pulled: 0 });
		await p1;
	});

	it('runs a fresh cycle after the previous one settles', async () => {
		syncFn.mockResolvedValue({ pushed: 0, pulled: 0 });

		await syncNow();
		await syncNow();

		expect(syncFn).toHaveBeenCalledTimes(2);
	});

	it('clears the in-flight guard even when a cycle rejects', async () => {
		syncFn.mockRejectedValueOnce(new Error('offline'));
		await expect(syncNow()).rejects.toThrow('offline');

		syncFn.mockResolvedValue({ pushed: 0, pulled: 0 });
		await expect(syncNow()).resolves.toBeDefined();
	});
});
