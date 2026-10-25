import { render } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import { describe, expect, it } from 'vitest';
import PageHeader from './PageHeader.svelte';

const snip = (t: string) => createRawSnippet(() => ({ render: () => `<span>${t}</span>` }));

describe('PageHeader', () => {
	it('renders the title as a heading', () => {
		const { getByRole } = render(PageHeader, { props: { title: 'Routines' } });
		expect(getByRole('heading', { name: 'Routines' })).toBeTruthy();
	});

	it('renders an action snippet when provided', () => {
		const { getByText } = render(PageHeader, { props: { title: 'X', action: snip('New') } });
		expect(getByText('New')).toBeTruthy();
	});

	it('renders no action wrapper without an action', () => {
		const { container } = render(PageHeader, { props: { title: 'X' } });
		expect(container.querySelector('.ph-action')).toBeNull();
	});

	it('renders a subtitle when provided', () => {
		const { getByText } = render(PageHeader, {
			props: { title: 'Today', subtitle: 'Ready to train?' }
		});
		expect(getByText('Ready to train?')).toBeTruthy();
	});
});

describe('PageHeader eyebrow', () => {
	it('renders an eyebrow above the title when provided', () => {
		const { getByTestId, getByRole } = render(PageHeader, {
			props: { title: 'History', eyebrow: '12 workouts' }
		});
		const eb = getByTestId('page-eyebrow');
		expect(eb.textContent).toBe('12 workouts');
		expect(eb.className).toContain('eyebrow');
		// Label comes before the heading in document order.
		const h = getByRole('heading', { name: 'History' });
		expect(eb.compareDocumentPosition(h) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
	});

	it('renders no eyebrow without one', () => {
		const { queryByTestId } = render(PageHeader, { props: { title: 'X' } });
		expect(queryByTestId('page-eyebrow')).toBeNull();
	});
});
