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
