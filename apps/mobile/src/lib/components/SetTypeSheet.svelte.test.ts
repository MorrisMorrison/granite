import { render } from '@testing-library/svelte';
import { fireEvent } from '@testing-library/dom';
import { describe, expect, it, vi } from 'vitest';
import SetTypeSheet from './SetTypeSheet.svelte';

const props = (over: Record<string, unknown> = {}) => ({
	open: true,
	type: 'normal',
	onpick: vi.fn(),
	ondelete: vi.fn(),
	onclose: vi.fn(),
	...over
});

describe('SetTypeSheet', () => {
	it('renders nothing while closed', () => {
		const { queryByTestId } = render(SetTypeSheet, { props: props({ open: false }) });
		expect(queryByTestId('set-type-warmup')).toBeNull();
	});

	it('lists every set type and marks the current one', () => {
		const { getByTestId } = render(SetTypeSheet, { props: props({ type: 'warmup' }) });
		for (const t of ['normal', 'warmup', 'top', 'backoff', 'drop', 'failure']) {
			expect(getByTestId(`set-type-${t}`)).toBeTruthy();
		}
		expect(getByTestId('set-type-warmup').classList.contains('on')).toBe(true);
		expect(getByTestId('set-type-normal').classList.contains('on')).toBe(false);
	});

	it('reports the picked type', async () => {
		const p = props();
		const { getByTestId } = render(SetTypeSheet, { props: p });
		await fireEvent.click(getByTestId('set-type-drop'));
		expect(p.onpick).toHaveBeenCalledWith('drop');
	});

	it('deletes the set from a red item', async () => {
		const p = props();
		const { getByTestId } = render(SetTypeSheet, { props: p });
		const del = getByTestId('btn-delete-set');
		expect(del.classList.contains('danger')).toBe(true);
		await fireEvent.click(del);
		expect(p.ondelete).toHaveBeenCalled();
	});
});
