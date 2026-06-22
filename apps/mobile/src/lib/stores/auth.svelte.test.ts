import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getMock, postMock, tokensMock } = vi.hoisted(() => ({
	getMock: vi.fn(),
	postMock: vi.fn(),
	tokensMock: { access: vi.fn(), refresh: vi.fn(), set: vi.fn(), clear: vi.fn() }
}));
vi.mock('$lib/api/client', () => ({ api: () => ({ GET: getMock, POST: postMock }) }));
vi.mock('$lib/api/tokens', () => ({ tokens: tokensMock }));

// Bootstrap side effects are exercised elsewhere; here they just need to be inert.
vi.mock('$lib/repo/exercises', () => ({ refreshExerciseLibrary: vi.fn(() => Promise.resolve()) }));
vi.mock('$lib/stores/prefs.svelte', () => ({ prefs: { load: vi.fn(() => Promise.resolve()) } }));
vi.mock('$lib/sync', () => ({ syncNow: vi.fn(() => Promise.resolve()) }));

import { auth } from './auth.svelte';

beforeEach(() => {
	localStorage.clear();
	vi.clearAllMocks();
	auth.user = null;
	auth.ready = false;
});

describe('register / login', () => {
	it('register stores tokens, sets + caches the user, and authenticates', async () => {
		postMock.mockResolvedValue({
			data: { access: 'a', refresh: 'r', user: { id: 'u1', email: 'e@x', display_name: 'E' } },
			error: undefined
		});

		await auth.register('e@x', 'pw');

		expect(tokensMock.set).toHaveBeenCalledWith('a', 'r');
		expect(auth.user).toMatchObject({ id: 'u1', email: 'e@x' });
		expect(auth.isAuthenticated).toBe(true);
		expect(JSON.parse(localStorage.getItem('granite.user')!)).toMatchObject({ id: 'u1' });
	});

	it('login throws and stays unauthenticated on bad credentials', async () => {
		postMock.mockResolvedValue({ data: undefined, error: { detail: 'bad' } });

		await expect(auth.login('e@x', 'wrong')).rejects.toThrow('Invalid email or password');
		expect(auth.isAuthenticated).toBe(false);
		expect(tokensMock.set).not.toHaveBeenCalled();
	});
});

describe('init (optimistic restore)', () => {
	it('restores the cached user when an access token exists', async () => {
		tokensMock.access.mockReturnValue('tok');
		localStorage.setItem('granite.user', JSON.stringify({ id: 'u1', email: 'e', display_name: 'E' }));
		getMock.mockResolvedValue({ data: { id: 'u1', email: 'e', display_name: 'E' }, response: { status: 200 } });

		await auth.init();

		expect(auth.ready).toBe(true);
		expect(auth.user).toMatchObject({ id: 'u1' });
	});

	it('stays logged out and ready when there is no token', async () => {
		tokensMock.access.mockReturnValue(null);

		await auth.init();

		expect(auth.ready).toBe(true);
		expect(auth.user).toBeNull();
	});

	it('clears the session when revalidation returns 401', async () => {
		tokensMock.access.mockReturnValue('tok');
		localStorage.setItem('granite.user', JSON.stringify({ id: 'u1', email: 'e', display_name: 'E' }));
		getMock.mockResolvedValue({ data: undefined, response: { status: 401 } });

		await auth.init();

		// revalidate runs in the background (init doesn't await it).
		await vi.waitFor(() => expect(auth.user).toBeNull());
		expect(tokensMock.clear).toHaveBeenCalled();
	});

	it('keeps the optimistic session when revalidation fails offline', async () => {
		tokensMock.access.mockReturnValue('tok');
		localStorage.setItem('granite.user', JSON.stringify({ id: 'u1', email: 'e', display_name: 'E' }));
		getMock.mockRejectedValue(new Error('offline'));

		await auth.init();

		expect(auth.user).toMatchObject({ id: 'u1' });
		expect(tokensMock.clear).not.toHaveBeenCalled();
	});
});

describe('logout', () => {
	it('best-effort revokes the refresh token and clears the session', async () => {
		tokensMock.refresh.mockReturnValue('r');
		postMock.mockResolvedValue({ data: {}, error: undefined });
		auth.user = { id: 'u1', email: 'e', display_name: 'E' };

		await auth.logout();

		expect(postMock).toHaveBeenCalledWith('/api/v1/auth/logout', { body: { refresh: 'r' } });
		expect(tokensMock.clear).toHaveBeenCalled();
		expect(auth.user).toBeNull();
	});
});
