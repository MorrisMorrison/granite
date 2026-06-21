// Core types for the offline-first sync client. The engine is store- and
// transport-agnostic: it talks to a `SyncApi` (the server) and a `SyncStore`
// (the device-local data). See docs/05-sync-and-offline.md and ADR-0008.

/** One record's state in the sync stream (mirrors the server's change shape). */
export interface Change {
	entity: string;
	id: string;
	/** Epoch ms; the last-write-wins key. */
	updated_at: number;
	deleted: boolean;
	data: unknown;
}

export interface PullResult {
	changes: Change[];
	cursor: number;
}

export interface PushResult {
	applied: string[];
	cursor: number;
}

/** The two sync calls the engine needs (backed by the generated API client). */
export interface SyncApi {
	pull(since: number): Promise<PullResult>;
	push(changes: Change[]): Promise<PushResult>;
}

/** The device-local store the engine reconciles against. */
export interface SyncStore {
	/** Pull watermark (epoch ms); 0 means "never synced". */
	getCursor(): Promise<number>;
	setCursor(cursor: number): Promise<void>;
	/** Local changes not yet confirmed by the server (the outbox). */
	getPending(): Promise<Change[]>;
	/** Drop outbox entries matching these pushed changes (by id + updated_at). */
	markPushed(pushed: Change[]): Promise<void>;
	/** Apply server changes locally, last-write-wins against local state. */
	applyRemote(changes: Change[]): Promise<void>;
}

export interface SyncResult {
	pushed: number;
	pulled: number;
	cursor: number;
}
