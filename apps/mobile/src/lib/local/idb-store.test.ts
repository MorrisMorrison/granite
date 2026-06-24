import 'fake-indexeddb/auto';

import { describe, expect, it } from 'vitest';

import { sync, type Change, type SyncApi } from '@granite/shared';

import { IdbSyncStore } from './idb-store';

let n = 0;
const freshStore = () => new IdbSyncStore(`test-${n++}-${Date.now()}`);

const ex = (id: string, updated_at: number, name: string, deleted = false): Change => ({
	entity: 'exercise',
	id,
	updated_at,
	deleted,
	data: { name }
});

const nameOf = (c: Change | undefined) => (c?.data as { name: string } | undefined)?.name;

/** Minimal server stand-in (updated_at-based, inclusive pull, LWW push). */
class FakeServer implements SyncApi {
	private records = new Map<string, Change>();
	async pull(since: number) {
		const changes = [...this.records.values()].filter((c) => c.updated_at >= since).map((c) => ({ ...c }));
		return { changes, cursor: changes.reduce((m, c) => Math.max(m, c.updated_at), since) };
	}
	async push(changes: Change[]) {
		const applied: string[] = [];
		for (const c of changes) {
			const k = `${c.entity}:${c.id}`;
			const e = this.records.get(k);
			if (!e || e.updated_at <= c.updated_at) {
				this.records.set(k, { ...c });
				applied.push(c.id);
			}
		}
		return { applied, cursor: changes.reduce((m, c) => Math.max(m, c.updated_at), 0) };
	}
}

describe('IdbSyncStore', () => {
	it('persists local writes and lists live records', async () => {
		const s = freshStore();
		await s.localWrite(ex('e1', 1000, 'Squat'));
		await s.localWrite(ex('e2', 1001, 'Bench'));
		expect(nameOf(await s.get('exercise', 'e1'))).toBe('Squat');
		expect(await s.list('exercise')).toHaveLength(2);

		await s.localWrite(ex('e1', 1002, 'Squat', true)); // soft-delete
		expect(await s.list('exercise')).toHaveLength(1);
	});

	it('applyRemote is last-write-wins; the cursor persists', async () => {
		const s = freshStore();
		await s.localWrite(ex('e1', 2000, 'mine'));
		await s.applyRemote([ex('e1', 1000, 'older')]); // older — ignored
		expect(nameOf(await s.get('exercise', 'e1'))).toBe('mine');
		await s.applyRemote([ex('e1', 3000, 'newer')]); // newer — wins
		expect(nameOf(await s.get('exercise', 'e1'))).toBe('newer');

		await s.setCursor(3000);
		expect(await s.getCursor()).toBe(3000);
	});

	it('clear() wipes records, outbox, and the cursor', async () => {
		const s = freshStore();
		await s.localWrite(ex('e1', 1000, 'Squat'));
		await s.setCursor(1000);
		expect(await s.get('exercise', 'e1')).toBeTruthy();

		await s.clear();

		expect(await s.get('exercise', 'e1')).toBeUndefined();
		expect(await s.getPending()).toHaveLength(0);
		expect(await s.getCursor()).toBe(0);
		expect(await s.list('exercise')).toHaveLength(0);
	});

	it('round-trips through the sync engine against a server', async () => {
		const server = new FakeServer();
		const a = freshStore();
		const b = freshStore();

		await a.localWrite(ex('e1', 1000, 'Squat'));
		const r = await sync(a, server);
		expect(r.pushed).toBe(1);
		expect(await a.getPending()).toHaveLength(0); // outbox cleared after push

		await sync(b, server);
		expect(nameOf(await b.get('exercise', 'e1'))).toBe('Squat');
		expect(await b.getCursor()).toBe(1000);
	});
});
