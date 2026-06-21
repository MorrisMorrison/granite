import { localStore } from '$lib/local/store';
import { syncNow } from '$lib/sync';
import type { Change } from '@granite/shared';
import { listRoutines, setRoutineFolder } from './routines';

// Must match the server's sync entity name (sync.EntityRoutineFolder), so folders
// round-trip: server-originated folders show up locally, and local folders sync up.
const FOLDER_ENTITY = 'routine_folder';

export interface FolderRow {
	id: string;
	name: string;
	order_index: number;
}

/** Folders from the local store, ordered. Works offline. */
export async function listFolders(): Promise<FolderRow[]> {
	const records = await localStore.list(FOLDER_ENTITY);
	return records
		.map((c) => {
			const d = c.data as { name?: string; order_index?: number };
			return { id: c.id, name: d.name ?? '', order_index: d.order_index ?? 0 };
		})
		.sort((a, b) => a.order_index - b.order_index || a.name.localeCompare(b.name));
}

async function writeFolder(id: string, updatedAt: number, data: object): Promise<void> {
	const change: Change = { entity: FOLDER_ENTITY, id, updated_at: updatedAt, deleted: false, data };
	await localStore.localWrite(change);
	void syncNow().catch(() => {}); // pushes online; queued in the outbox offline
}

/** Create a folder (works offline). Returns the id. */
export async function createFolder(name: string): Promise<string> {
	const now = Date.now();
	const id = crypto.randomUUID();
	const existing = await listFolders();
	await writeFolder(id, now, { name: name.trim(), order_index: existing.length, created_at: now });
	return id;
}

/** Rename a folder, preserving order_index/created_at. */
export async function renameFolder(id: string, name: string): Promise<void> {
	const existing = await localStore.get(FOLDER_ENTITY, id);
	if (!existing) return;
	const d = existing.data as { order_index?: number; created_at?: number };
	await writeFolder(id, Date.now(), {
		name: name.trim(),
		order_index: d.order_index ?? 0,
		created_at: d.created_at ?? Date.now()
	});
}

/** Delete a folder. Its routines are moved to "ungrouped" first so they don't disappear. */
export async function deleteFolder(id: string): Promise<void> {
	const routines = await listRoutines();
	for (const r of routines) {
		if (r.folder_id === id) await setRoutineFolder(r.id, null);
	}
	const change: Change = { entity: FOLDER_ENTITY, id, updated_at: Date.now(), deleted: true, data: {} };
	await localStore.localWrite(change);
	void syncNow().catch(() => {});
}
