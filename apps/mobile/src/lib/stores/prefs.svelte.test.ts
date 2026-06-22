import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getMock, patchMock } = vi.hoisted(() => ({ getMock: vi.fn(), patchMock: vi.fn() }));
vi.mock('$lib/api/client', () => ({ api: () => ({ GET: getMock, PATCH: patchMock }) }));

import { prefs } from './prefs.svelte';

beforeEach(() => {
	localStorage.clear();
	getMock.mockReset();
	patchMock.mockReset();
	patchMock.mockResolvedValue({});
});

describe('prefs.update', () => {
	it('applies the patch locally and persists to localStorage + the server', async () => {
		await prefs.update({ weightUnit: 'lb' });

		expect(prefs.current.weightUnit).toBe('lb');
		expect(JSON.parse(localStorage.getItem('granite.prefs')!)).toMatchObject({ weightUnit: 'lb' });
		// Inspect the call body field-by-field — `current` is a Svelte $state proxy,
		// so a whole-object deep-equal is brittle.
		expect(patchMock).toHaveBeenCalledTimes(1);
		const [path, opts] = patchMock.mock.calls[0] as [
			string,
			{ body: { settings: { weightUnit: string } } }
		];
		expect(path).toBe('/api/v1/me');
		expect(opts.body.settings.weightUnit).toBe('lb');
	});

	it('keeps the local cache when the server PATCH fails (offline)', async () => {
		patchMock.mockRejectedValue(new Error('offline'));
		await prefs.update({ weightUnit: 'lb' });
		expect(prefs.current.weightUnit).toBe('lb');
		expect(JSON.parse(localStorage.getItem('granite.prefs')!)).toMatchObject({ weightUnit: 'lb' });
	});
});

describe('prefs.load', () => {
	it('hydrates from the server, sanitizing out-of-range values to defaults', async () => {
		getMock.mockResolvedValue({ data: { settings: { weightUnit: 'lb', restSeconds: 5000 } } });

		await prefs.load();

		expect(prefs.current.weightUnit).toBe('lb');
		expect(prefs.current.restSeconds).toBe(90); // 5000 is out of range → default
	});

	it('ignores an invalid weightUnit, falling back to the default', async () => {
		getMock.mockResolvedValue({ data: { settings: { weightUnit: 'stone', restSeconds: 120 } } });

		await prefs.load();

		expect(prefs.current.weightUnit).toBe('kg');
		expect(prefs.current.restSeconds).toBe(120);
	});

	it('keeps cached prefs when the request throws (offline)', async () => {
		await prefs.update({ weightUnit: 'lb' });
		getMock.mockRejectedValue(new Error('offline'));

		await prefs.load();

		expect(prefs.current.weightUnit).toBe('lb');
	});
});
