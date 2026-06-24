import { createSyncApi, sync, type SyncResult } from '@granite/shared';

import { api } from '$lib/api/client';
import { localStore } from '$lib/local/store';

let running: Promise<SyncResult> | null = null;

/**
 * Run one sync cycle (push local changes, pull remote) against the configured
 * server, deduping concurrent calls. Callers that are offline should catch the
 * rejection and carry on against local data.
 */
export function syncNow(): Promise<SyncResult> {
	if (!running) {
		running = sync(localStore, createSyncApi(api())).finally(() => {
			running = null;
		});
	}
	return running;
}

/**
 * Reset the pull cursor, then sync — so the next pull replays the full history.
 * Needed after a server-side import: imported records keep their original
 * updated_at (older than an already-synced device's cursor), so an incremental
 * pull would skip them.
 */
export async function resync(): Promise<SyncResult> {
	await localStore.setCursor(0);
	return syncNow();
}

/**
 * Wipe all device-local data (records, outbox, cursor). Used on logout and the
 * manual "reset local data" action so a stale cache can be re-pulled clean — pair
 * it with syncNow() to immediately repopulate from the server.
 */
export async function resetLocalData(): Promise<void> {
	await localStore.clear();
}
