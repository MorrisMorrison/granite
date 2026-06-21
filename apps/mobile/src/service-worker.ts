/// <reference types="@sveltejs/kit" />
/// <reference lib="webworker" />

import { build, files, prerendered } from '$service-worker';

const sw = self as unknown as ServiceWorkerGlobalScope;

const CACHE = 'granite-v1';
// Shell + all hashed app chunks + static files, so every route loads offline.
const PRECACHE = ['/', ...build, ...files, ...prerendered];

sw.addEventListener('install', (event) => {
	event.waitUntil(
		caches
			.open(CACHE)
			.then((c) => c.addAll(PRECACHE))
			.then(() => sw.skipWaiting())
	);
});

sw.addEventListener('activate', (event) => {
	// App chunks are content-hashed, so we DON'T purge the cache on activate — that
	// would yank chunks out from under a tab still running the previous build during
	// an update. Old hashes simply accumulate (cheap) and '/' is overwritten on each
	// install. Just take control of open pages.
	event.waitUntil(sw.clients.claim());
});

sw.addEventListener('fetch', (event) => {
	const req = event.request;
	if (req.method !== 'GET') return;

	const url = new URL(req.url);
	if (url.origin !== sw.location.origin) return; // leave cross-origin (e.g. a remote API) alone
	if (url.pathname.startsWith('/api/')) return; // never cache API calls

	event.respondWith(
		(async () => {
			const cache = await caches.open(CACHE);
			const cached = await cache.match(req);
			if (cached) return cached;

			try {
				const res = await fetch(req);
				// Runtime-cache successful same-origin responses (e.g. on-demand route chunks).
				if (res.ok && res.type === 'basic') {
					cache.put(req, res.clone());
				}
				return res;
			} catch {
				// Offline: fall back to the cached SPA shell for client-side navigations.
				if (req.mode === 'navigate') {
					const shell = await cache.match('/');
					if (shell) return shell;
				}
				throw new Error('offline and not cached');
			}
		})()
	);
});
