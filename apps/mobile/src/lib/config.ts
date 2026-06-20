const SERVER_KEY = 'granite.serverUrl';

/** The Granite server base URL. Stored per-device (self-hosters point at their own instance). */
export function getServerUrl(): string {
	if (typeof localStorage !== 'undefined') {
		const saved = localStorage.getItem(SERVER_KEY);
		if (saved) return saved;
	}
	return import.meta.env.VITE_GRANITE_API ?? 'http://localhost:8080';
}

export function setServerUrl(url: string): void {
	if (typeof localStorage !== 'undefined') localStorage.setItem(SERVER_KEY, url);
}
