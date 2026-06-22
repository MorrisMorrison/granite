import { render } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';

// TabBar highlights the tab matching the current path.
vi.mock('$app/state', () => ({ page: { url: { pathname: '/routines' } } }));

import TabBar from './TabBar.svelte';

describe('TabBar', () => {
	it('renders the four primary tabs', () => {
		const { getByTestId } = render(TabBar);
		for (const id of ['nav-tab-today', 'nav-tab-routines', 'nav-tab-history', 'nav-tab-exercises']) {
			expect(getByTestId(id)).toBeTruthy();
		}
	});

	it('marks the tab matching the current path as active', () => {
		const { getByTestId } = render(TabBar);
		const routines = getByTestId('nav-tab-routines');
		expect(routines.className).toContain('active');
		expect(routines.getAttribute('aria-current')).toBe('page');

		const today = getByTestId('nav-tab-today');
		expect(today.className).not.toContain('active');
		expect(today.getAttribute('aria-current')).toBeNull();
	});
});
