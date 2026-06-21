import { render } from '@testing-library/svelte';
import { fireEvent } from '@testing-library/dom';
import { createRawSnippet } from 'svelte';
import { describe, expect, it, vi } from 'vitest';
import Sheet from './Sheet.svelte';

const body = (t: string) => createRawSnippet(() => ({ render: () => `<p>${t}</p>` }));

describe('Sheet', () => {
	it('renders nothing when closed', () => {
		const { queryByRole, queryByText } = render(Sheet, {
			props: { open: false, onclose: () => {}, children: body('Hidden') }
		});
		expect(queryByRole('dialog')).toBeNull();
		expect(queryByText('Hidden')).toBeNull();
	});

	it('renders title and body when open', () => {
		const { getByRole, getByText } = render(Sheet, {
			props: { open: true, title: 'Add exercise', onclose: () => {}, children: body('Pick one') }
		});
		expect(getByRole('dialog')).toBeTruthy();
		expect(getByText('Add exercise')).toBeTruthy();
		expect(getByText('Pick one')).toBeTruthy();
	});

	it('calls onclose when the backdrop is clicked', async () => {
		const onclose = vi.fn();
		const { container } = render(Sheet, { props: { open: true, onclose, children: body('x') } });
		await fireEvent.click(container.querySelector('.backdrop')!);
		expect(onclose).toHaveBeenCalledTimes(1);
	});

	it('calls onclose from the close button', async () => {
		const onclose = vi.fn();
		const { container } = render(Sheet, { props: { open: true, onclose, children: body('x') } });
		await fireEvent.click(container.querySelector('.x')!);
		expect(onclose).toHaveBeenCalledTimes(1);
	});

	it('calls onclose on Escape', async () => {
		const onclose = vi.fn();
		render(Sheet, { props: { open: true, onclose, children: body('x') } });
		await fireEvent.keyDown(window, { key: 'Escape' });
		expect(onclose).toHaveBeenCalledTimes(1);
	});
});
