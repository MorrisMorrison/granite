import { createGraniteClient } from '@granite/shared';

import { getServerUrl } from '$lib/config';
import { tokens } from '$lib/api/tokens';

// Dedupe concurrent refreshes: all clients share one token pair, so a burst of
// 401s should trigger a single refresh, not one per request.
let refreshing: Promise<boolean> | null = null;

async function refreshAccessToken(baseUrl: string): Promise<boolean> {
	const refresh = tokens.refresh();
	if (!refresh) return false;
	if (!refreshing) {
		refreshing = (async () => {
			const res = await fetch(`${baseUrl}/api/v1/auth/refresh`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ refresh })
			});
			if (!res.ok) {
				tokens.clear();
				return false;
			}
			const data = (await res.json()) as { access: string; refresh: string };
			tokens.set(data.access, data.refresh);
			return true;
		})()
			.catch(() => false)
			.finally(() => {
				refreshing = null;
			});
	}
	return refreshing;
}

/**
 * Returns a typed Granite API client bound to the configured server, with the
 * access token attached and silent refresh-on-401: when a request fails auth,
 * the client refreshes the token once and replays the request. This is the single
 * seam through which the app talks to the backend — swapping to a local-SQLite-
 * backed repository (offline-first) later is contained here.
 */
export function api() {
	const baseUrl = getServerUrl();
	const client = createGraniteClient(baseUrl);
	// Keep an unconsumed clone of each request so a 401 can be replayed with a
	// fresh token (the original body is consumed by the first fetch).
	const replayable = new Map<string | undefined, Request>();

	client.use({
		onRequest({ request, id }) {
			const access = tokens.access();
			if (access) request.headers.set('Authorization', `Bearer ${access}`);
			replayable.set(id, request.clone());
			return request;
		},
		async onResponse({ request, response, id }) {
			const clone = replayable.get(id);
			replayable.delete(id);
			if (response.status !== 401) return response;
			// Never try to refresh on the auth endpoints themselves.
			if (new URL(request.url).pathname.startsWith('/api/v1/auth/')) return response;
			if (!clone) return response;

			const refreshed = await refreshAccessToken(baseUrl);
			if (!refreshed) return response;

			clone.headers.set('Authorization', `Bearer ${tokens.access()}`);
			// A direct fetch bypasses this middleware, so the replay can't loop.
			return fetch(clone);
		},
		onError({ id }) {
			replayable.delete(id);
		}
	});
	return client;
}
