import type { Change, SyncStore } from './types';

const key = (c: { entity: string; id: string }) => `${c.entity}:${c.id}`;

/**
 * Reference SyncStore backed by in-memory maps. Useful for tests and as an
 * executable model of the contract a real (device SQLite) store must satisfy:
 * records and the outbox are keyed by entity:id, reconciliation is last-write-wins
 * by updated_at, and a pushed edit only leaves the outbox if it hasn't been
 * superseded by a newer local edit.
 */
export class MemorySyncStore implements SyncStore {
	private records = new Map<string, Change>();
	private outbox = new Map<string, Change>();
	private cursor = 0;

	async getCursor(): Promise<number> {
		return this.cursor;
	}

	async setCursor(cursor: number): Promise<void> {
		this.cursor = cursor;
	}

	async getPending(): Promise<Change[]> {
		return [...this.outbox.values()];
	}

	async markPushed(pushed: Change[]): Promise<void> {
		for (const c of pushed) {
			const cur = this.outbox.get(key(c));
			if (cur && cur.updated_at === c.updated_at) {
				this.outbox.delete(key(c));
			}
		}
	}

	async applyRemote(changes: Change[]): Promise<void> {
		for (const c of changes) {
			const local = this.records.get(key(c));
			if (local && local.updated_at > c.updated_at) {
				continue; // local is newer — keep it
			}
			this.records.set(key(c), c);
			const pending = this.outbox.get(key(c));
			if (pending && pending.updated_at <= c.updated_at) {
				this.outbox.delete(key(c)); // stale pending edit, superseded
			}
		}
	}

	/** Record a local change: updates local state and queues it for the next push. */
	localWrite(change: Change): void {
		this.records.set(key(change), change);
		this.outbox.set(key(change), change);
	}

	/** Read a local record (undefined if absent). */
	get(entity: string, id: string): Change | undefined {
		return this.records.get(`${entity}:${id}`);
	}

	/** All live (non-deleted) local records. */
	all(): Change[] {
		return [...this.records.values()].filter((c) => !c.deleted);
	}
}
