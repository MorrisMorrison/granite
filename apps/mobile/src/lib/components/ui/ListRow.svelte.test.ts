import { render } from '@testing-library/svelte';
import { fireEvent } from '@testing-library/dom';
import { createRawSnippet } from 'svelte';
import { describe, expect, it, vi } from 'vitest';
import ListRow from './ListRow.svelte';

const snip = (t: string) => createRawSnippet(() => ({ render: () => `<span>${t}</span>` }));

describe('ListRow', () => {
	it('renders title and subtitle', () => {
		const { getByText } = render(ListRow, { props: { title: 'Squat', subtitle: 'Quadriceps' } });
		expect(getByText('Squat')).toBeTruthy();
		expect(getByText('Quadriceps')).toBeTruthy();
	});

	it('renders an <a> when href is set', () => {
		const { getByRole } = render(ListRow, { props: { title: 'Go', href: '/routines/1' } });
		expect(getByRole('link').getAttribute('href')).toBe('/routines/1');
	});

	it('renders a <button> and fires onclick', async () => {
		const onclick = vi.fn();
		const { getByRole } = render(ListRow, { props: { title: 'Tap', onclick } });
		await fireEvent.click(getByRole('button'));
		expect(onclick).toHaveBeenCalledTimes(1);
	});

	it('renders a plain element (no link/button) with neither href nor onclick', () => {
		const { queryByRole, getByText } = render(ListRow, { props: { title: 'Static' } });
		expect(queryByRole('link')).toBeNull();
		expect(queryByRole('button')).toBeNull();
		expect(getByText('Static')).toBeTruthy();
	});

	it('renders the trailing snippet', () => {
		const { getByText } = render(ListRow, { props: { title: 'X', trailing: snip('TR') } });
		expect(getByText('TR')).toBeTruthy();
	});
});
