import { render } from '@testing-library/svelte';
import { fireEvent } from '@testing-library/dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { goto, checkServer, resetLocalData } = vi.hoisted(() => ({
	goto: vi.fn(),
	checkServer: vi.fn(),
	resetLocalData: vi.fn(() => Promise.resolve())
}));
vi.mock('$app/navigation', () => ({ goto }));
vi.mock('$app/state', () => ({ page: { url: new URL('http://localhost/connect') } }));
vi.mock('#lib/sync/index.ts', () => ({ resetLocalData }));
vi.mock('#lib/stores/auth.svelte.ts', () => ({ auth: { isAuthenticated: false } }));
vi.mock('#lib/connect.ts', async (orig) => ({ ...(await orig<typeof import('#lib/connect.ts')>()), checkServer }));

import Connect from './+page.svelte';

beforeEach(() => {
	localStorage.clear();
	vi.clearAllMocks();
});

describe('/connect', () => {
	it('saves a valid server and continues to login', async () => {
		checkServer.mockResolvedValue({ ok: true, url: 'https://granite.example.com' });
		const { getByTestId } = render(Connect);
		await fireEvent.input(getByTestId('field-server-url'), { target: { value: 'granite.example.com' } });
		await fireEvent.click(getByTestId('btn-connect'));
		await vi.waitFor(() => expect(goto).toHaveBeenCalledWith('/login'));
		expect(localStorage.getItem('granite.serverUrl')).toBe('https://granite.example.com');
		expect(resetLocalData).not.toHaveBeenCalled(); // first server: nothing to clear
	});

	it('clears local data when switching to a different server', async () => {
		localStorage.setItem('granite.serverUrl', 'https://old.example');
		checkServer.mockResolvedValue({ ok: true, url: 'https://new.example' });
		const { getByTestId } = render(Connect);
		await fireEvent.input(getByTestId('field-server-url'), { target: { value: 'new.example' } });
		await fireEvent.click(getByTestId('btn-connect'));
		await vi.waitFor(() => expect(resetLocalData).toHaveBeenCalled());
		expect(localStorage.getItem('granite.serverUrl')).toBe('https://new.example');
	});

	it.each([
		['unreachable', 'No server answered at down.example. Check the address and your connection.'],
		['not-found', 'No current Granite server found at down.example. Check the address, or update the server.'],
		['not-granite', "That address doesn't look like a Granite server."],
		['outdated', 'This Granite server needs an update to work with the app.']
	])('shows the %s message and stays', async (reason, message) => {
		checkServer.mockResolvedValue({ ok: false, reason });
		const { getByTestId } = render(Connect);
		await fireEvent.input(getByTestId('field-server-url'), { target: { value: 'down.example' } });
		await fireEvent.click(getByTestId('btn-connect'));
		await vi.waitFor(() => expect(getByTestId('connect-error').textContent).toBe(message));
		expect(goto).not.toHaveBeenCalled();
		expect(localStorage.getItem('granite.serverUrl')).toBeNull();
	});
});
