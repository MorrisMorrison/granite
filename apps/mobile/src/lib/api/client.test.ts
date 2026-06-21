import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { api } from './client';

function makeStorage(): Storage {
	const m = new Map<string, string>();
	return {
		getItem: (k) => m.get(k) ?? null,
		setItem: (k, v) => void m.set(k, String(v)),
		removeItem: (k) => void m.delete(k),
		clear: () => m.clear(),
		key: () => null,
		length: 0
	} as Storage;
}

const authHeader = (input: Request | string, init?: RequestInit): string => {
	if (typeof input !== 'string') return input.headers.get('Authorization') ?? '';
	const h = init?.headers;
	return (h instanceof Headers ? h.get('Authorization') : (h as Record<string, string>)?.Authorization) ?? '';
};

const json = (body: unknown, status: number) =>
	new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('api() silent refresh-on-401', () => {
	beforeEach(() => {
		vi.stubGlobal('localStorage', makeStorage());
	});
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it('refreshes the token on 401 and replays the request once', async () => {
		localStorage.setItem('granite.access', 'old-access');
		localStorage.setItem('granite.refresh', 'old-refresh');

		const fetchMock = vi.fn(async (input: Request | string, init?: RequestInit) => {
			const url = typeof input === 'string' ? input : input.url;
			if (url.endsWith('/api/v1/auth/refresh')) {
				return json({ access: 'new-access', refresh: 'new-refresh' }, 200);
			}
			if (authHeader(input, init) === 'Bearer new-access') {
				return json(
					{ id: 'u1', email: 'a@b.com', display_name: 'A', created_at: 0, updated_at: 0, settings: null },
					200
				);
			}
			return json({ error: 'unauthorized', code: 'unauthorized' }, 401);
		});
		vi.stubGlobal('fetch', fetchMock);

		const { data, response } = await api().GET('/api/v1/me');

		expect(response.status).toBe(200);
		expect(data?.id).toBe('u1');
		expect(localStorage.getItem('granite.access')).toBe('new-access');
		// original 401 + refresh + replay
		expect(fetchMock).toHaveBeenCalledTimes(3);
	});

	it('clears tokens and surfaces the 401 when refresh fails', async () => {
		localStorage.setItem('granite.access', 'old-access');
		localStorage.setItem('granite.refresh', 'expired');

		vi.stubGlobal(
			'fetch',
			vi.fn(async (input: Request | string) => {
				const url = typeof input === 'string' ? input : input.url;
				if (url.endsWith('/api/v1/auth/refresh')) return json({ error: 'invalid' }, 401);
				return json({ error: 'unauthorized' }, 401);
			})
		);

		const { response } = await api().GET('/api/v1/me');

		expect(response.status).toBe(401);
		expect(localStorage.getItem('granite.access')).toBeNull();
		expect(localStorage.getItem('granite.refresh')).toBeNull();
	});

	it('does not attempt refresh without a refresh token', async () => {
		localStorage.setItem('granite.access', 'old-access');

		const fetchMock = vi.fn(async () => json({ error: 'unauthorized' }, 401));
		vi.stubGlobal('fetch', fetchMock);

		const { response } = await api().GET('/api/v1/me');

		expect(response.status).toBe(401);
		expect(fetchMock).toHaveBeenCalledTimes(1); // no refresh, no replay
	});
});
