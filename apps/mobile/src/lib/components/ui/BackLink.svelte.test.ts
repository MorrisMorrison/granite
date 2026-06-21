import { render } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import BackLink from './BackLink.svelte';

describe('BackLink', () => {
	it('renders a link to href with the given label', () => {
		const { getByRole } = render(BackLink, { props: { href: '/routines', label: 'Routines' } });
		const link = getByRole('link', { name: /Routines/ });
		expect(link.getAttribute('href')).toBe('/routines');
	});

	it('defaults the label to "Back"', () => {
		const { getByRole } = render(BackLink, { props: { href: '/x' } });
		expect(getByRole('link').textContent).toContain('Back');
	});
});
