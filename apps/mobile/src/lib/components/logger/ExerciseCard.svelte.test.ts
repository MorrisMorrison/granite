import { render } from '@testing-library/svelte';
import { fireEvent } from '@testing-library/dom';
import { describe, expect, it, vi } from 'vitest';
import ExerciseCard from './ExerciseCard.svelte';

const mk = (over = {}) => ({
	uid: 'e1',
	exercise_id: 'x',
	name: 'Bench Press',
	sets: [
		{ uid: 'a', set_type: 'normal', weight: 60, reps: 5, is_completed: true },
		{ uid: 'b', set_type: 'normal', weight: 60, reps: 5, is_completed: false }
	],
	prev: [{ weight: 55, reps: 5 }],
	...over
});
// A reactive (proxied) exercise, as the logger page holds it, so in-card edits re-render.
const props = (init = mk(), over = {}) => {
	const ex = $state(init);
	return {
		ex,
		unit: 'kg' as const,
		barbell: false,
		onremove: () => {},
		ontoggle: () => {},
		onaddset: () => {},
		...over
	};
};

describe('ExerciseCard', () => {
	it('shows done/total progress and previous values', () => {
		const { container, getAllByTestId, getByText } = render(ExerciseCard, { props: props() });
		expect(getByText('1/2 sets')).toBeTruthy();
		expect(container.querySelector('.fill.complete')).toBeNull();
		expect(getAllByTestId('set-row')[0].textContent).toContain('55 × 5');
		expect(getAllByTestId('set-row')[1].textContent).toContain('—');
	});

	it('fills the bar with the success colour class once complete', () => {
		const ex = mk();
		ex.sets[1].is_completed = true;
		const { container } = render(ExerciseCard, { props: props(ex) });
		expect(container.querySelector('.fill.complete')).not.toBeNull();
	});

	it('offers Plates only for barbell exercises, plus Remove exercise', async () => {
		const onremove = vi.fn();
		const a = render(ExerciseCard, { props: props(mk(), { onremove }) });
		await fireEvent.click(a.getByTestId('btn-ex-menu'));
		expect(a.queryByTestId('btn-plates')).toBeNull();
		await fireEvent.click(a.getByText('Remove exercise'));
		expect(onremove).toHaveBeenCalled();
		a.unmount();

		const b = render(ExerciseCard, { props: props(mk(), { barbell: true }) });
		await fireEvent.click(b.getByTestId('btn-ex-menu'));
		expect(b.getByTestId('btn-plates')).toBeTruthy();
	});

	it('changes a set type from the badge sheet and relabels it W', async () => {
		const { getAllByTestId, getByTestId } = render(ExerciseCard, { props: props() });
		await fireEvent.click(getAllByTestId('set-label')[0]);
		await fireEvent.click(getByTestId('set-type-warmup'));
		expect(getAllByTestId('set-label')[0].textContent).toBe('W');
		expect(getAllByTestId('set-label')[1].textContent).toBe('1');
	});

	it('deletes a set from the badge sheet', async () => {
		const { getAllByTestId, getByTestId } = render(ExerciseCard, { props: props() });
		await fireEvent.click(getAllByTestId('set-label')[0]);
		await fireEvent.click(getByTestId('btn-delete-set'));
		expect(getAllByTestId('set-row')).toHaveLength(1);
	});
});
