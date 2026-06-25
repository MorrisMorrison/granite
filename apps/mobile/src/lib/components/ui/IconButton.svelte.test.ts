import { render } from '@testing-library/svelte';
import { fireEvent } from '@testing-library/dom';
import { describe, expect, it, vi } from 'vitest';
import IconButton from './IconButton.svelte';

describe('IconButton', () => {
	it('renders a button with an accessible label and fires onclick', async () => {
		const onclick = vi.fn();
		const { getByRole } = render(IconButton, {
			props: { name: 'trash', label: 'Delete', onclick }
		});
		const btn = getByRole('button', { name: 'Delete' });
		await fireEvent.click(btn);
		expect(onclick).toHaveBeenCalledTimes(1);
	});

	it('renders a link when href is set', () => {
		const { getByRole } = render(IconButton, {
			props: { name: 'play', label: 'Start', href: '/log' }
		});
		expect(getByRole('link', { name: 'Start' }).getAttribute('href')).toBe('/log');
	});
});
