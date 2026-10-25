import { render } from '@testing-library/svelte';
import { fireEvent } from '@testing-library/dom';
import { describe, expect, it, vi } from 'vitest';
import WorkoutHeader from './WorkoutHeader.svelte';

describe('WorkoutHeader', () => {
	it('spaces the separator: "00:01 · Push"', () => {
		const { getByTestId } = render(WorkoutHeader, {
			props: { elapsed: '00:01', routineName: 'Push', ondeload: () => {} }
		});
		expect(getByTestId('elapsed').textContent).toBe('00:01 · Push');
	});

	it('shows just the clock without a routine and hides the deload chip', () => {
		const { getByTestId, queryByTestId } = render(WorkoutHeader, {
			props: { elapsed: '00:09', ondeload: () => {} }
		});
		expect(getByTestId('elapsed').textContent).toBe('00:09');
		expect(queryByTestId('deload')).toBeNull();
	});

	it('picks a deload percentage from the sheet', async () => {
		const ondeload = vi.fn();
		const { getByTestId } = render(WorkoutHeader, {
			props: { elapsed: '00:09', showDeload: true, deloadPct: 0, ondeload }
		});
		expect(getByTestId('deload').textContent).toContain('none');
		await fireEvent.click(getByTestId('deload'));
		await fireEvent.click(getByTestId('deload-10'));
		expect(ondeload).toHaveBeenCalledWith(10);
	});
});
