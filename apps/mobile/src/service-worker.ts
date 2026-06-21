/// <reference types="@sveltejs/kit" />
/// <reference lib="webworker" />

import { build, files, prerendered } from '$service-worker';

const sw = self as unknown as ServiceWorkerGlobalScope;

const CACHE = 'granite-v1';
// Shell + all hashed app chunks + static files, so every route loads offline.
const PRECACHE = ['/', ...build, ...files, ...prerendered];

sw.addEventListener('install', (event) => {
	// Cache entries individually (not addAll) so one transient failure can't abort
	// the whole precache and leave route chunks missing.
	event.waitUntil(
		caches
			.open(CACHE)
			.then((c) => Promise.allSettled(PRECACHE.map((url) => c.add(url))))
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

	// Content-hashed build assets never change for a given URL → cache-first.
	const immutable = url.pathname.startsWith('/_app/immutable/');

	event.respondWith(
		(async () => {
			const cache = await caches.open(CACHE);

			if (immutable) {
				const hit = await cache.match(req);
				if (hit) return hit;
				const res = await fetch(req);
				if (res.ok) cache.put(req, res.clone());
				return res;
			}

			// The app shell (/, navigations) and other files are network-first, so an
			// online load always gets the current build (no stale shell), with the cache
			// as the offline fallback.
			try {
				const res = await fetch(req);
				if (res.ok && res.type === 'basic') cache.put(req, res.clone());
				return res;
			} catch {
				const hit = await cache.match(req);
				if (hit) return hit;
				if (req.mode === 'navigate') {
					const shell = await cache.match('/');
					if (shell) return shell;
				}
				throw new Error('offline and not cached');
			}
		})()
	);
});
