import { render } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import { describe, expect, it } from 'vitest';
import Badge from './Badge.svelte';

const label = (t: string) => createRawSnippet(() => ({ render: () => `<span>${t}</span>` }));

describe('Badge', () => {
	it('renders children with the default muted variant', () => {
		const { getByText, container } = render(Badge, { props: { children: label('built-in') } });
		expect(getByText('built-in')).toBeTruthy();
		expect(container.querySelector('.badge')!.className).toContain('v-muted');
	});

	it('applies the accent variant', () => {
		const { container } = render(Badge, { props: { variant: 'accent', children: label('write') } });
		expect(container.querySelector('.badge')!.className).toContain('v-accent');
	});
});
