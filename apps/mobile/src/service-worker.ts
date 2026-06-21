/// <reference types="@sveltejs/kit" />
/// <reference lib="webworker" />

import { build, files, prerendered, version } from '$service-worker';

const sw = self as unknown as ServiceWorkerGlobalScope;

const CACHE = `granite-${version}`;
// App shell + hashed assets + static files + the SPA entry, so the app loads offline.
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
	event.waitUntil(
		caches
			.keys()
			.then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
			.then(() => sw.clients.claim())
	);
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

			// Precached shell/assets: cache-first.
			if (url.pathname === '/' || PRECACHE.includes(url.pathname)) {
				const hit = await cache.match(url.pathname);
				if (hit) return hit;
			}

			// Otherwise go to the network, falling back to cache — and to the cached SPA
			// shell for client-side navigations (so deep links work offline).
			try {
				return await fetch(req);
			} catch {
				const hit = await cache.match(url.pathname);
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
