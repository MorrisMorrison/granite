const SERVER_KEY = 'granite.serverUrl';

/** The Granite server base URL. Stored per-device (self-hosters point at their own instance). */
export function getServerUrl(): string {
	if (typeof localStorage !== 'undefined') {
		const saved = localStorage.getItem(SERVER_KEY);
		if (saved) return saved;
	}
	// Explicit build-time override wins; in dev point at the local API; in a
	// production build default to same-origin (the binary serves API + web app).
	if (import.meta.env.VITE_GRANITE_API) return import.meta.env.VITE_GRANITE_API;
	if (import.meta.env.DEV) return 'http://localhost:8080';
	if (typeof window !== 'undefined') return window.location.origin;
	return 'http://localhost:8080';
}

export function setServerUrl(url: string): void {
	if (typeof localStorage !== 'undefined') localStorage.setItem(SERVER_KEY, url);
}
