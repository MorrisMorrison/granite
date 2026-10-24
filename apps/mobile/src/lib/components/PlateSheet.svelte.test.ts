import { render } from '@testing-library/svelte';
import { fireEvent } from '@testing-library/dom';
import { describe, expect, it, vi } from 'vitest';
import PlateSheet from './PlateSheet.svelte';

const mkSets = () => [
	{ uid: 'w', set_type: 'warmup', weight: 40, is_completed: true },
	{ uid: 'a', set_type: 'normal', weight: 60, is_completed: true },
	{ uid: 'b', set_type: 'normal', weight: 65, is_completed: false },
	{ uid: 'c', set_type: 'normal', weight: 65, is_completed: false }
];

function setup(sets = mkSets()) {
	const onclose = vi.fn();
	const r = render(PlateSheet, {
		props: { open: true, title: 'Plates · Bench', sets, unit: 'kg', onclose }
	});
	return { ...r, sets, onclose };
}

const selected = (chips: HTMLElement[]) => chips.findIndex((c) => c.getAttribute('aria-selected') === 'true');

describe('PlateSheet', () => {
	it('opens on the next set that is not completed yet', () => {
		const { getAllByTestId, getByTestId } = setup();
		expect(selected(getAllByTestId('plate-set-chip'))).toBe(2);
		expect((getByTestId('field-plate-target') as HTMLInputElement).value).toBe('65');
	});

	it('labels warm-ups W and numbers work sets', () => {
		const { getAllByTestId } = setup();
		const labels = getAllByTestId('plate-set-chip').map((c) => c.querySelector('span')!.textContent);
		expect(labels).toEqual(['W', '1', '2', '3']);
	});

	it('switches sets from the chips', async () => {
		const { getAllByTestId, getByTestId } = setup();
		await fireEvent.click(getAllByTestId('plate-set-chip')[0]);
		expect(selected(getAllByTestId('plate-set-chip'))).toBe(0);
		expect((getByTestId('field-plate-target') as HTMLInputElement).value).toBe('40');
	});

	it('writes the stepped total back to that set', async () => {
		const { getByLabelText, sets } = setup();
		await fireEvent.click(getByLabelText('Plus 2.5 kg'));
		expect(sets[2].weight).toBe(67.5);
		expect(sets[3].weight).toBe(65); // other sets untouched
	});

	it('falls back to the first set when all are done, and hides chips for a single set', () => {
		const done = mkSets().map((s) => ({ ...s, is_completed: true }));
		const all = setup(done);
		expect(selected(all.getAllByTestId('plate-set-chip'))).toBe(0);
		all.unmount();

		const one = setup([{ uid: 'x', set_type: 'normal', weight: 100, is_completed: false }]);
		expect(one.queryAllByTestId('plate-set-chip')).toHaveLength(0);
		expect((one.getByTestId('field-plate-target') as HTMLInputElement).value).toBe('100');
	});

	it('closes via the sheet', async () => {
		const { getAllByLabelText, onclose } = setup();
		await fireEvent.click(getAllByLabelText('Close')[1]);
		expect(onclose).toHaveBeenCalledTimes(1);
	});
});
