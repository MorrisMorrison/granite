// The native app's "Connect to your server" check. A CORS-blocked request fails
// exactly like an unreachable host, so reachability is probed first with a no-cors
// request (works against any server), then identity with a normal request. Reachable
// but blocked can't be narrowed further: any non-Granite site and a Granite server
// that predates the app both block it, so the message covers both.

export const MIN_API_VERSION = 1;
const TIMEOUT_MS = 8000;

export type ConnectFailure = 'invalid' | 'unreachable' | 'not-found' | 'not-granite' | 'outdated';
export type ConnectResult = { ok: true; url: string } | { ok: false; reason: ConnectFailure };

/** Normalise user input to `scheme://host[:port][/path]` without a trailing slash; null if unusable. */
export function normalizeServerUrl(input: string): string | null {
	const raw = input.trim();
	if (!raw) return null;
	const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
	let u: URL;
	try {
		u = new URL(withScheme);
	} catch {
		return null;
	}
	if ((u.protocol !== 'https:' && u.protocol !== 'http:') || !u.hostname || /\s/.test(raw)) return null;
	return `${u.protocol}//${u.host}${u.pathname.replace(/\/+$/, '')}`;
}

export async function checkServer(input: string, fetchFn: typeof fetch = fetch): Promise<ConnectResult> {
	const url = normalizeServerUrl(input);
	if (!url) return { ok: false, reason: 'invalid' };
	try {
		await fetchFn(`${url}/healthz`, { mode: 'no-cors', cache: 'no-store', signal: AbortSignal.timeout(TIMEOUT_MS) });
	} catch {
		return { ok: false, reason: 'unreachable' };
	}
	let res: Response;
	try {
		res = await fetchFn(`${url}/api/v1/info`, { cache: 'no-store', signal: AbortSignal.timeout(TIMEOUT_MS) });
	} catch {
		return { ok: false, reason: 'not-found' };
	}
	if (!res.ok) return { ok: false, reason: 'not-granite' };
	let body: { name?: unknown; api_version?: unknown };
	try {
		body = await res.json();
	} catch {
		return { ok: false, reason: 'not-granite' };
	}
	if (!body || body.name !== 'granite') return { ok: false, reason: 'not-granite' };
	if (typeof body.api_version !== 'number' || body.api_version < MIN_API_VERSION) return { ok: false, reason: 'outdated' };
	return { ok: true, url };
}

/** User-facing copy for a failed check. */
export function connectMessage(reason: ConnectFailure, input: string): string {
	const url = normalizeServerUrl(input);
	const host = url ? new URL(url).host : input.trim();
	switch (reason) {
		case 'unreachable':
			return `No server answered at ${host}. Check the address and your connection.`;
		case 'not-found':
			return `No current Granite server found at ${host}. Check the address, or update the server.`;
		case 'not-granite':
			return "That address doesn't look like a Granite server.";
		case 'outdated':
			return 'This Granite server needs an update to work with the app.';
		case 'invalid':
			return "Enter your server's address, e.g. granite.example.com.";
	}
}
