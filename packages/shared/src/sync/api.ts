import type { GraniteClient } from '../api/client';
import type { Change, SyncApi } from './types';

/** Adapts the generated API client to the SyncApi the engine expects. */
export function createSyncApi(client: GraniteClient): SyncApi {
	return {
		async pull(since) {
			const { data, error } = await client.POST('/api/v1/sync/pull', { body: { since } });
			if (error || !data) {
				throw new Error(`sync pull failed: ${JSON.stringify(error)}`);
			}
			return { changes: (data.changes ?? []) as Change[], cursor: data.cursor };
		},
		async push(changes) {
			const { data, error } = await client.POST('/api/v1/sync/push', { body: { changes } });
			if (error || !data) {
				throw new Error(`sync push failed: ${JSON.stringify(error)}`);
			}
			return { applied: data.applied ?? [], cursor: data.cursor };
		},
	};
}
