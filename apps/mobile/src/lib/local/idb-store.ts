import { openDB, type IDBPDatabase } from 'idb';

import type { Change, SyncStore } from '@granite/shared';

const RECORDS = 'records';
const OUTBOX = 'outbox';
const META = 'meta';
const CURSOR_KEY = 'cursor';
const SERVER_ID_KEY = 'server_instance_id';

const key = (c: { entity: string; id: string }) => `${c.entity}:${c.id}`;

/**
 * Device-local store backed by IndexedDB (web/PWA — see ADR-0010). Implements the
 * SyncStore contract the sync engine drives, plus the read/write methods the app's
 * repository uses. Mirrors MemorySyncStore's semantics: records + outbox + cursor,
 * reconciled last-write-wins by updated_at.
 */
export class IdbSyncStore implements SyncStore {
	private dbp: Promise<IDBPDatabase>;

	constructor(name = 'granite') {
		this.dbp = openDB(name, 1, {
			upgrade(db) {
				db.createObjectStore(RECORDS);
				db.createObjectStore(OUTBOX);
				db.createObjectStore(META);
			}
		});
	}

	async getCursor(): Promise<number> {
		const db = await this.dbp;
		return ((await db.get(META, CURSOR_KEY)) as number | undefined) ?? 0;
	}

	async setCursor(cursor: number): Promise<void> {
		const db = await this.dbp;
		await db.put(META, cursor, CURSOR_KEY);
	}

	/** The server instance id this store was last reconciled against (undefined until
	 * the first successful server-info check). Cleared by clear(). */
	async getServerId(): Promise<string | undefined> {
		const db = await this.dbp;
		return (await db.get(META, SERVER_ID_KEY)) as string | undefined;
	}

	async setServerId(id: string): Promise<void> {
		const db = await this.dbp;
		await db.put(META, id, SERVER_ID_KEY);
	}

	async getPending(): Promise<Change[]> {
		const db = await this.dbp;
		return (await db.getAll(OUTBOX)) as Change[];
	}

	async markPushed(pushed: Change[]): Promise<void> {
		const db = await this.dbp;
		const tx = db.transaction(OUTBOX, 'readwrite');
		for (const c of pushed) {
			const cur = (await tx.store.get(key(c))) as Change | undefined;
			if (cur && cur.updated_at === c.updated_at) {
				await tx.store.delete(key(c));
			}
		}
		await tx.done;
	}

	async applyRemote(changes: Change[]): Promise<void> {
		const db = await this.dbp;
		const tx = db.transaction([RECORDS, OUTBOX], 'readwrite');
		const records = tx.objectStore(RECORDS);
		const outbox = tx.objectStore(OUTBOX);
		for (const c of changes) {
			const local = (await records.get(key(c))) as Change | undefined;
			if (local && local.updated_at > c.updated_at) continue; // local is newer
			await records.put(c, key(c));
			const pending = (await outbox.get(key(c))) as Change | undefined;
			if (pending && pending.updated_at <= c.updated_at) {
				await outbox.delete(key(c)); // stale pending edit, superseded
			}
		}
		await tx.done;
	}

	/** Record a local change: update local state and queue it for the next push. */
	async localWrite(change: Change): Promise<void> {
		const db = await this.dbp;
		const tx = db.transaction([RECORDS, OUTBOX], 'readwrite');
		await tx.objectStore(RECORDS).put(change, key(change));
		await tx.objectStore(OUTBOX).put(change, key(change));
		await tx.done;
	}

	/** Read one record (undefined if absent). */
	async get(entity: string, id: string): Promise<Change | undefined> {
		const db = await this.dbp;
		return (await db.get(RECORDS, `${entity}:${id}`)) as Change | undefined;
	}

	/** All live (non-deleted) records of an entity type. */
	async list(entity: string): Promise<Change[]> {
		const db = await this.dbp;
		const all = (await db.getAll(RECORDS)) as Change[];
		return all.filter((c) => c.entity === entity && !c.deleted);
	}

	/** Wipe all device-local state — records, outbox, and the pull cursor. Used on
	 * logout and the manual "reset local data" action so a stale cache (e.g. after a
	 * server reset) can be re-pulled clean. */
	async clear(): Promise<void> {
		const db = await this.dbp;
		const tx = db.transaction([RECORDS, OUTBOX, META], 'readwrite');
		await tx.objectStore(RECORDS).clear();
		await tx.objectStore(OUTBOX).clear();
		await tx.objectStore(META).clear();
		await tx.done;
	}
}
