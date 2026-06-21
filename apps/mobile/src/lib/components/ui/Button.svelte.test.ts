import { render } from '@testing-library/svelte';
import { fireEvent } from '@testing-library/dom';
import { createRawSnippet } from 'svelte';
import { describe, expect, it, vi } from 'vitest';
import Button from './Button.svelte';

const label = (text: string) => createRawSnippet(() => ({ render: () => `<span>${text}</span>` }));

describe('Button', () => {
	it('renders a <button> with the label by default', () => {
		const { getByRole } = render(Button, { props: { children: label('Save') } });
		const btn = getByRole('button', { name: 'Save' });
		expect(btn.tagName).toBe('BUTTON');
		expect(btn.className).toContain('v-primary');
		expect(btn.className).toContain('s-md');
	});

	it('renders an <a> when href is set', () => {
		const { getByRole } = render(Button, { props: { href: '/routines', children: label('Go') } });
		const link = getByRole('link', { name: 'Go' });
		expect(link.tagName).toBe('A');
		expect(link.getAttribute('href')).toBe('/routines');
	});

	it('applies variant, size, block and testid', () => {
		const { getByTestId } = render(Button, {
			props: { variant: 'secondary', size: 'sm', block: true, testid: 'btn-x', children: label('X') }
		});
		const btn = getByTestId('btn-x');
		expect(btn.className).toContain('v-secondary');
		expect(btn.className).toContain('s-sm');
		expect(btn.className).toContain('block');
	});

	it('renders a leading icon svg', () => {
		const { container } = render(Button, { props: { icon: 'plus', children: label('Add') } });
		expect(container.querySelector('svg')).not.toBeNull();
	});

	it('calls onclick when clicked', async () => {
		const onclick = vi.fn();
		const { getByRole } = render(Button, { props: { onclick, children: label('Hit') } });
		await fireEvent.click(getByRole('button'));
		expect(onclick).toHaveBeenCalledTimes(1);
	});

	it('sets the disabled attribute', () => {
		const { getByRole } = render(Button, {
			props: { disabled: true, children: label('Nope') }
		});
		expect((getByRole('button') as HTMLButtonElement).disabled).toBe(true);
	});
});
