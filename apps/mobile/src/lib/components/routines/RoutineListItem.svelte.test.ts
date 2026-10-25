import { render } from '@testing-library/svelte';
import { fireEvent } from '@testing-library/dom';
import { describe, expect, it, vi } from 'vitest';
import RoutineListItem from './RoutineListItem.svelte';

describe('RoutineListItem', () => {
	it('links to detail and start, with a spaced subtitle', () => {
		const { getByTestId, container } = render(RoutineListItem, {
			props: { id: 'r1', title: 'Push', exerciseCount: 4, lastDone: 'yesterday', onmenu: () => {} }
		});
		expect(container.querySelector('a.body')!.getAttribute('href')).toBe('/routines/r1');
		expect(getByTestId('btn-start-routine').getAttribute('href')).toBe('/log?routine=r1');
		expect(getByTestId('routine-row').textContent).toContain('4 exercises · last done yesterday');
	});

	it('handles singular, never-done and not-yet-loaded counts', () => {
		const a = render(RoutineListItem, {
			props: { id: 'r', title: 'T', exerciseCount: 1, lastDone: null, onmenu: () => {} }
		});
		expect(a.getByTestId('routine-row').textContent).toContain('1 exercise · not done yet');
		a.unmount();
		const b = render(RoutineListItem, { props: { id: 'r', title: 'T', onmenu: () => {} } });
		expect(b.getByTestId('routine-row').textContent).not.toContain('exercise');
	});

	it('fires onmenu', async () => {
		const onmenu = vi.fn();
		const { getByTestId } = render(RoutineListItem, { props: { id: 'r', title: 'T', onmenu } });
		await fireEvent.click(getByTestId('btn-routine-menu'));
		expect(onmenu).toHaveBeenCalled();
	});
});
