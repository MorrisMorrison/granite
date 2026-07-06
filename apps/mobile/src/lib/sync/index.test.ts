import { beforeEach, describe, expect, it, vi } from 'vitest';

// syncNow wires the shared sync engine to the app's store + API client. We mock
// those collaborators and assert the deduping behaviour syncNow adds on top.
const { syncFn, createSyncApi, setCursor, getMock, getServerId, setServerId, clear, hasPending } =
	vi.hoisted(() => ({
		syncFn: vi.fn(),
		createSyncApi: vi.fn(() => ({})),
		setCursor: vi.fn(() => Promise.resolve()),
		getMock: vi.fn(),
		getServerId: vi.fn(() => Promise.resolve<string | undefined>(undefined)),
		setServerId: vi.fn(() => Promise.resolve()),
		clear: vi.fn(() => Promise.resolve()),
		hasPending: vi.fn(() => Promise.resolve(false))
	}));
vi.mock('@granite/shared', () => ({ sync: syncFn, createSyncApi }));
vi.mock('$lib/api/client', () => ({ api: vi.fn(() => ({ GET: getMock })) }));
vi.mock('$lib/local/store', () => ({
	localStore: { setCursor, getServerId, setServerId, clear, hasPending }
}));

import { resync, syncNow } from './index';

beforeEach(() => {
	syncFn.mockReset();
	setCursor.mockClear();
	getMock.mockReset();
	getMock.mockResolvedValue({ data: { instance_id: 'srv-1' } });
	getServerId.mockReset();
	getServerId.mockResolvedValue(undefined);
	setServerId.mockClear();
	clear.mockClear();
	hasPending.mockReset();
	hasPending.mockResolvedValue(false);
});

describe('syncNow', () => {
	it('dedupes concurrent calls into a single sync cycle', async () => {
		let resolve!: (v: unknown) => void;
		syncFn.mockReturnValue(new Promise((r) => (resolve = r)));

		const p1 = syncNow();
		const p2 = syncNow();

		expect(p1).toBe(p2); // same in-flight cycle (deduped synchronously)

		resolve({ pushed: 0, pulled: 0 });
		await p1;
		expect(syncFn).toHaveBeenCalledOnce(); // only one underlying cycle ran
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

describe('reconcileServerInstance (via syncNow)', () => {
	it('wipes local data when the server instance id changed', async () => {
		getMock.mockResolvedValue({ data: { instance_id: 'srv-2' } });
		getServerId.mockResolvedValue('srv-1'); // previously synced against a different DB
		syncFn.mockResolvedValue({ pushed: 0, pulled: 0 });

		await syncNow();

		expect(clear).toHaveBeenCalledOnce();
		expect(setServerId).toHaveBeenCalledWith('srv-2');
	});

	it('attempts a final push before wiping when the outbox is non-empty', async () => {
		getMock.mockResolvedValue({ data: { instance_id: 'srv-2' } });
		getServerId.mockResolvedValue('srv-1'); // different DB
		hasPending.mockResolvedValueOnce(true).mockResolvedValueOnce(false); // pushed clean
		syncFn.mockResolvedValue({ pushed: 1, pulled: 0 });

		await syncNow();

		// One reconcile-phase push (the guard) + the normal post-reconcile sync.
		expect(syncFn).toHaveBeenCalledTimes(2);
		expect(clear).toHaveBeenCalledOnce();
	});

	it('warns but still wipes when the outbox cannot be flushed before rotation', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		getMock.mockResolvedValue({ data: { instance_id: 'srv-2' } });
		getServerId.mockResolvedValue('srv-1');
		hasPending.mockResolvedValue(true); // still pending even after the push attempt
		syncFn.mockRejectedValueOnce(new Error('offline')); // guard push fails
		syncFn.mockResolvedValue({ pushed: 0, pulled: 0 }); // post-reconcile sync

		await syncNow();

		expect(warn).toHaveBeenCalled();
		expect(clear).toHaveBeenCalledOnce();
		warn.mockRestore();
	});

	it('does not wipe on first run or when the instance is unchanged', async () => {
		getMock.mockResolvedValue({ data: { instance_id: 'srv-1' } });
		getServerId.mockResolvedValue('srv-1');
		syncFn.mockResolvedValue({ pushed: 0, pulled: 0 });

		await syncNow();

		expect(clear).not.toHaveBeenCalled();
		expect(setServerId).toHaveBeenCalledWith('srv-1');
	});

	it('still syncs when the server-info check fails (offline / old server)', async () => {
		getMock.mockRejectedValue(new Error('offline'));
		syncFn.mockResolvedValue({ pushed: 0, pulled: 0 });

		await syncNow();

		expect(clear).not.toHaveBeenCalled();
		expect(syncFn).toHaveBeenCalledOnce();
	});
});

describe('resync', () => {
	it('resets the cursor to 0, then syncs (full re-pull)', async () => {
		syncFn.mockResolvedValue({ pushed: 0, pulled: 0 });

		await resync();

		expect(setCursor).toHaveBeenCalledWith(0);
		expect(syncFn).toHaveBeenCalledOnce();
	});
});
