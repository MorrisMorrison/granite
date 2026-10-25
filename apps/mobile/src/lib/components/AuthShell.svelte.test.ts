import { render } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import { describe, expect, it } from 'vitest';
import AuthShell from './AuthShell.svelte';

const snip = (html: string) => createRawSnippet(() => ({ render: () => html }));

describe('AuthShell', () => {
	it('renders the brand, eyebrow, title, subtitle and form', () => {
		const { getByRole, getByText } = render(AuthShell, {
			props: {
				eyebrow: 'Log in',
				title: 'Welcome back',
				subtitle: 'Pick up where you left off.',
				children: snip('<form data-testid="the-form"></form>')
			}
		});
		expect(getByText('Granite')).toBeTruthy();
		const eb = getByText('Log in');
		expect(eb.className).toContain('eyebrow');
		const h = getByRole('heading', { level: 1, name: 'Welcome back' });
		expect(eb.compareDocumentPosition(h) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
		expect(getByText('Pick up where you left off.')).toBeTruthy();
		expect(document.querySelector('[data-testid="the-form"]')).not.toBeNull();
	});

	it('renders the footer snippet only when given', () => {
		const props = { eyebrow: 'E', title: 'T', children: snip('<div></div>') };
		const a = render(AuthShell, { props: { ...props, footer: snip('<p>No account?</p>') } });
		expect(a.getByText('No account?')).toBeTruthy();
		a.unmount();
		const b = render(AuthShell, { props });
		expect(b.container.querySelector('.auth-foot')).toBeNull();
		expect(b.container.querySelector('.auth-sub')).toBeNull();
	});
});
