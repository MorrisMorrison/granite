import type { SyncApi, SyncResult, SyncStore } from './types';

/**
 * Run one sync cycle: push local pending changes, then pull remote changes.
 *
 * Push-first so local edits reach the server before we pull; the pull then brings
 * other devices' changes and re-confirms ours. Both directions are idempotent and
 * last-write-wins, so a cycle is safe to retry after a failure (partial progress —
 * a successful push followed by a failed pull — is never lost or duplicated).
 */
export async function sync(store: SyncStore, api: SyncApi): Promise<SyncResult> {
	let pushed = 0;
	const pending = await store.getPending();
	if (pending.length > 0) {
		await api.push(pending);
		// Clear the whole sent batch: records that won LWW are now on the server;
		// records that lost will be overwritten by the newer server version in the
		// pull below. markPushed only clears entries still at the pushed updated_at,
		// so an edit made mid-push survives.
		await store.markPushed(pending);
		pushed = pending.length;
	}

	const since = await store.getCursor();
	const { changes, cursor } = await api.pull(since);
	if (changes.length > 0) {
		await store.applyRemote(changes);
	}
	await store.setCursor(cursor);

	return { pushed, pulled: changes.length, cursor };
}
