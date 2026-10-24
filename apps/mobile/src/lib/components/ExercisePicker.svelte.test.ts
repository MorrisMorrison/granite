import { render, waitFor } from '@testing-library/svelte';
import { fireEvent } from '@testing-library/dom';
import { describe, expect, it, vi } from 'vitest';
import ExercisePicker from './ExercisePicker.svelte';

const library = [
	{ id: 'e1', name: 'Barbell Bench Press', primary_muscle: 'Chest' },
	{ id: 'e2', name: 'Barbell Row', primary_muscle: 'Back' },
	{ id: 'e3', name: 'Pull Up', primary_muscle: 'Lats' }
];

function setup(props: Partial<{ open: boolean; library: typeof library | null }> = {}) {
	const onpick = vi.fn();
	const oncreate = vi.fn(() => Promise.resolve());
	const onclose = vi.fn();
	const r = render(ExercisePicker, {
		props: { open: true, library, onpick, oncreate, onclose, ...props }
	});
	return { ...r, onpick, oncreate, onclose };
}

const names = (els: HTMLElement[]) => els.map((el) => el.querySelector('span')!.textContent);

describe('ExercisePicker', () => {
	it('shows a loading state until the library arrives', () => {
		const { getByText, queryByTestId } = setup({ library: null });
		expect(getByText('Loading…')).toBeTruthy();
		expect(queryByTestId('field-picker-search')).toBeNull();
	});

	it('lists the whole library and focuses the search on open', async () => {
		const { getAllByTestId, getByTestId } = setup();
		expect(getAllByTestId('picker-exercise')).toHaveLength(3);
		await waitFor(() => expect(document.activeElement).toBe(getByTestId('field-picker-search')));
	});

	it('narrows the list as you type (name or muscle)', async () => {
		const { getAllByTestId, getByTestId } = setup();
		const search = getByTestId('field-picker-search');

		await fireEvent.input(search, { target: { value: 'barbell' } });
		expect(names(getAllByTestId('picker-exercise'))).toEqual(['Barbell Bench Press', 'Barbell Row']);

		await fireEvent.input(search, { target: { value: 'LATS' } });
		expect(names(getAllByTestId('picker-exercise'))).toEqual(['Pull Up']);
	});

	it('picks an exercise', async () => {
		const { getAllByTestId, getByTestId, onpick } = setup();
		await fireEvent.input(getByTestId('field-picker-search'), { target: { value: 'row' } });
		await fireEvent.click(getAllByTestId('picker-exercise')[0]);
		expect(onpick).toHaveBeenCalledWith(library[1]);
	});

	it('offers to create the searched name when nothing matches', async () => {
		const { getByTestId, getByText, queryAllByTestId } = setup();
		await fireEvent.input(getByTestId('field-picker-search'), { target: { value: ' Zercher Squat ' } });

		expect(queryAllByTestId('picker-exercise')).toHaveLength(0);
		expect(getByTestId('picker-empty').textContent).toContain('No exercises match “Zercher Squat”');

		await fireEvent.click(getByText('Create “Zercher Squat”'));
		expect((getByTestId('field-exercise-name') as HTMLInputElement).value).toBe('Zercher Squat');
	});

	it('creates a new exercise from the New button', async () => {
		const { getByTestId, oncreate } = setup();
		await fireEvent.click(getByTestId('btn-picker-new-exercise'));
		await fireEvent.input(getByTestId('field-exercise-name'), { target: { value: 'Cable Fly' } });
		await fireEvent.input(getByTestId('field-exercise-muscle'), { target: { value: 'Chest' } });
		await fireEvent.click(getByTestId('btn-save-exercise'));
		expect(oncreate).toHaveBeenCalledWith(
			expect.objectContaining({ name: 'Cable Fly', primary_muscle: 'Chest' })
		);
	});

	it('resets the search each time it reopens', async () => {
		const { getAllByTestId, getByTestId, rerender } = setup();
		await fireEvent.input(getByTestId('field-picker-search'), { target: { value: 'pull' } });
		expect(getAllByTestId('picker-exercise')).toHaveLength(1);

		await rerender({ open: false });
		await rerender({ open: true });
		expect((getByTestId('field-picker-search') as HTMLInputElement).value).toBe('');
		expect(getAllByTestId('picker-exercise')).toHaveLength(3);
	});
});
