import { createGraniteClient } from '@granite/shared';

import { getServerUrl } from '$lib/config';
import { tokens } from '$lib/api/tokens';

/**
 * Returns a typed Granite API client bound to the configured server, with the
 * access token attached. This is the single seam through which the app talks to
 * the backend — swapping to a local-SQLite-backed repository (offline-first)
 * later is contained here.
 */
export function api() {
	const client = createGraniteClient(getServerUrl());
	client.use({
		onRequest({ request }) {
			const access = tokens.access();
			if (access) request.headers.set('Authorization', `Bearer ${access}`);
			return request;
		}
	});
	return client;
}
