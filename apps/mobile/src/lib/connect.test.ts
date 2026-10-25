import { describe, expect, it, vi } from 'vitest';
import { checkServer, connectMessage, normalizeServerUrl } from './connect';

describe('normalizeServerUrl', () => {
	it('adds https, drops trailing slashes and paths, keeps ports', () => {
		expect(normalizeServerUrl('granite.example.com')).toBe('https://granite.example.com');
		expect(normalizeServerUrl(' https://granite.example.com/ ')).toBe('https://granite.example.com');
		expect(normalizeServerUrl('http://192.168.1.5:8080/')).toBe('http://192.168.1.5:8080');
		expect(normalizeServerUrl('https://example.com/granite/')).toBe('https://example.com/granite');
	});

	it('rejects empty or unparseable input', () => {
		expect(normalizeServerUrl('')).toBeNull();
		expect(normalizeServerUrl('   ')).toBeNull();
		expect(normalizeServerUrl('ftp://x')).toBeNull();
		expect(normalizeServerUrl('not a url')).toBeNull();
	});
});

// fetch stub: healthz (no-cors probe) and info (cors) answer per scenario.
function stub(opts: { reachable: boolean; info?: 'cors-blocked' | Response }) {
	return vi.fn(async (url: string, init?: RequestInit) => {
		if (!opts.reachable) throw new TypeError('Failed to fetch');
		if (url.endsWith('/healthz')) {
			expect(init?.mode).toBe('no-cors');
			return new Response(null, { status: 200 });
		}
		if (opts.info === 'cors-blocked') throw new TypeError('Failed to fetch');
		return opts.info!;
	}) as unknown as typeof fetch;
}
const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('checkServer', () => {
	it('accepts a current Granite server', async () => {
		const r = await checkServer('granite.example.com', stub({ reachable: true, info: json({ name: 'granite', api_version: 1 }) }));
		expect(r).toEqual({ ok: true, url: 'https://granite.example.com' });
	});

	it('flags invalid input without fetching', async () => {
		const f = stub({ reachable: true });
		expect(await checkServer('  ', f)).toEqual({ ok: false, reason: 'invalid' });
		expect(f).not.toHaveBeenCalled();
	});

	it('flags an unreachable host', async () => {
		expect(await checkServer('down.example', stub({ reachable: false }))).toEqual({ ok: false, reason: 'unreachable' });
	});

	it('reports a reachable host whose identity check is blocked as "not found"', async () => {
		// Browsers block it for any non-Granite site and for Granite servers that predate the app alike.
		expect(await checkServer('example.com', stub({ reachable: true, info: 'cors-blocked' }))).toEqual({ ok: false, reason: 'not-found' });
	});

	it('flags a too-old api_version as outdated', async () => {
		const r = await checkServer('old.example', stub({ reachable: true, info: json({ name: 'granite', api_version: 0 }) }));
		expect(r).toEqual({ ok: false, reason: 'outdated' });
	});

	it('flags something that is not Granite', async () => {
		expect(await checkServer('x.example', stub({ reachable: true, info: json({ hello: 'world' }) }))).toEqual({ ok: false, reason: 'not-granite' });
		expect(await checkServer('x.example', stub({ reachable: true, info: new Response('<html>', { status: 200 }) }))).toEqual({ ok: false, reason: 'not-granite' });
		expect(await checkServer('x.example', stub({ reachable: true, info: json({}, 404) }))).toEqual({ ok: false, reason: 'not-granite' });
	});
});

describe('connectMessage', () => {
	it('uses the exact copy', () => {
		expect(connectMessage('unreachable', 'https://down.example')).toBe('No server answered at down.example. Check the address and your connection.');
		expect(connectMessage('not-found', 'https://example.com')).toBe('No current Granite server found at example.com. Check the address, or update the server.');
		expect(connectMessage('not-granite', 'x')).toBe("That address doesn't look like a Granite server.");
		expect(connectMessage('outdated', 'x')).toBe('This Granite server needs an update to work with the app.');
		expect(connectMessage('invalid', '')).toBe("Enter your server's address, e.g. granite.example.com.");
	});
});
