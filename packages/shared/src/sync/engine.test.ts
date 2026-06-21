import { describe, expect, it } from 'vitest';

import { sync } from './engine';
import { MemorySyncStore } from './memory-store';
import type { Change, SyncApi } from './types';

const clone = (c: Change): Change => ({ ...c, data: structuredClone(c.data) });

/** A minimal server stand-in: updated_at-based, inclusive pull, LWW push. */
class FakeServer implements SyncApi {
	private records = new Map<string, Change>();

	async pull(since: number) {
		const changes = [...this.records.values()].filter((c) => c.updated_at >= since).map(clone);
		const cursor = changes.reduce((m, c) => Math.max(m, c.updated_at), since);
		return { changes, cursor };
	}

	async push(changes: Change[]) {
		const applied: string[] = [];
		for (const c of changes) {
			const k = `${c.entity}:${c.id}`;
			const ex = this.records.get(k);
			if (!ex || ex.updated_at <= c.updated_at) {
				this.records.set(k, clone(c));
				applied.push(c.id);
			}
		}
		const cursor = changes.reduce((m, c) => Math.max(m, c.updated_at), 0);
		return { applied, cursor };
	}
}

const ex = (id: string, updated_at: number, name: string, deleted = false): Change => ({
	entity: 'exercise',
	id,
	updated_at,
	deleted,
	data: { name },
});

const nameOf = (c: Change | undefined) => (c?.data as { name: string } | undefined)?.name;

describe('sync engine', () => {
	it('propagates a change from one device to another', async () => {
		const server = new FakeServer();
		const a = new MemorySyncStore();
		const b = new MemorySyncStore();

		a.localWrite(ex('e1', 1000, 'Squat'));
		const r = await sync(a, server);
		expect(r.pushed).toBe(1);
		expect(await a.getPending()).toHaveLength(0); // outbox cleared after push

		await sync(b, server);
		expect(nameOf(b.get('exercise', 'e1'))).toBe('Squat');
		expect(await b.getCursor()).toBe(1000);
	});

	it('resolves conflicts last-write-wins (older local edit loses)', async () => {
		const server = new FakeServer();
		const a = new MemorySyncStore();
		const b = new MemorySyncStore();

		a.localWrite(ex('e1', 2000, 'A-new'));
		await sync(a, server);

		b.localWrite(ex('e1', 1000, 'B-old')); // older, conflicting edit
		await sync(b, server);

		expect(nameOf(b.get('exercise', 'e1'))).toBe('A-new'); // server's newer version wins
		expect(await b.getPending()).toHaveLength(0); // stale pending dropped
	});

	it('a newer local edit wins and reaches other devices', async () => {
		const server = new FakeServer();
		const a = new MemorySyncStore();
		const b = new MemorySyncStore();

		a.localWrite(ex('e1', 1000, 'old'));
		await sync(a, server);
		await sync(b, server);

		b.localWrite(ex('e1', 3000, 'b-new'));
		await sync(b, server);
		await sync(a, server);

		expect(nameOf(a.get('exercise', 'e1'))).toBe('b-new');
	});

	it('propagates deletions as tombstones', async () => {
		const server = new FakeServer();
		const a = new MemorySyncStore();
		const b = new MemorySyncStore();

		a.localWrite(ex('e1', 1000, 'Squat'));
		await sync(a, server);
		await sync(b, server);

		a.localWrite(ex('e1', 2000, 'Squat', true)); // delete
		await sync(a, server);
		await sync(b, server);

		expect(b.get('exercise', 'e1')?.deleted).toBe(true);
		expect(b.all()).toHaveLength(0);
	});

	it('is idempotent: re-syncing with no local changes is a no-op', async () => {
		const server = new FakeServer();
		const a = new MemorySyncStore();

		a.localWrite(ex('e1', 1000, 'Squat'));
		await sync(a, server);
		const r = await sync(a, server);

		expect(r.pushed).toBe(0);
		expect(await a.getPending()).toHaveLength(0);
		expect(a.all()).toHaveLength(1); // no duplication
	});

	it('pulls later changes and advances the cursor', async () => {
		const server = new FakeServer();
		const a = new MemorySyncStore();
		const b = new MemorySyncStore();

		a.localWrite(ex('e1', 1000, 'one'));
		await sync(a, server);
		await sync(b, server); // b now has e1, cursor 1000

		a.localWrite(ex('e2', 2000, 'two'));
		await sync(a, server);
		await sync(b, server);

		expect(b.get('exercise', 'e2')).toBeDefined();
		expect(await b.getCursor()).toBe(2000);
		expect(b.all()).toHaveLength(2);
	});
});
