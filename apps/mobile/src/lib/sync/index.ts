import { createSyncApi, sync, type SyncResult } from '@granite/shared';

import { api } from '$lib/api/client';
import { localStore } from '$lib/local/store';

let running: Promise<SyncResult> | null = null;

/**
 * Detect a reset/recreated server DB and wipe the local cache before syncing, so
 * a server reset doesn't leave the client with orphaned/duplicate records. The
 * server's instance id changes when its DB is recreated; we compare it to the
 * last-seen value. Best-effort: any error (offline, old server without the
 * endpoint) is swallowed so a normal sync still proceeds.
 */
async function reconcileServerInstance(): Promise<void> {
	try {
		const { data } = await api().GET('/api/v1/server-info');
		const serverId = data?.instance_id;
		if (!serverId) return;
		const seen = await localStore.getServerId();
		if (seen && seen !== serverId) {
			// Different DB → the stale cache + cursor must go. But if there are queued
			// local changes, they belong to the *old* server and can't be pushed there
			// anymore; the wipe would drop them silently. Best-effort: try one push at
			// the new server first, and warn if anything is still pending afterwards so
			// the loss is at least surfaced rather than silent.
			if (await localStore.hasPending()) {
				try {
					await sync(localStore, createSyncApi(api()));
				} catch {
					/* offline / rejected — fall through to the warning below */
				}
				if (await localStore.hasPending()) {
					console.warn(
						'[sync] server instance changed with unsynced local changes still queued; ' +
							'these could not be pushed and will be discarded by the reset.'
					);
				}
			}
			await localStore.clear(); // different DB → drop the stale cache + cursor
		}
		await localStore.setServerId(serverId);
	} catch {
		/* offline or endpoint unavailable — skip and let the normal sync run */
	}
}

/**
 * Run one sync cycle (push local changes, pull remote) against the configured
 * server, deduping concurrent calls. Callers that are offline should catch the
 * rejection and carry on against local data.
 */
export function syncNow(): Promise<SyncResult> {
	if (!running) {
		running = (async () => {
			await reconcileServerInstance();
			return sync(localStore, createSyncApi(api()));
		})().finally(() => {
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

/** Whether the local outbox has changes not yet confirmed by the server. Guards
 *  destructive wipes (logout) from silently dropping unsynced work. */
export function hasPending(): Promise<boolean> {
	return localStore.hasPending();
}

/** Ask the browser to make the local store persistent so it isn't evicted under
 *  storage pressure — the offline-first source of truth lives here. Best-effort and
 *  guarded: unsupported environments (and non-browser test runs) are a no-op. */
export function requestPersistentStorage(): void {
	try {
		void navigator?.storage?.persist?.();
	} catch {
		/* not supported / not a browser — ignore */
	}
}
