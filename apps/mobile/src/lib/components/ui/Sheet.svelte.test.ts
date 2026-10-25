import { render, waitFor } from '@testing-library/svelte';
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

	it('focuses the dialog on open', async () => {
		const { getByRole } = render(Sheet, { props: { open: true, onclose: () => {}, children: body('x') } });
		await waitFor(() => expect(document.activeElement).toBe(getByRole('dialog')));
	});

	it('focuses a data-autofocus child instead when present', async () => {
		const field = createRawSnippet(() => ({ render: () => '<input data-autofocus aria-label="q" />' }));
		const { getByLabelText } = render(Sheet, { props: { open: true, onclose: () => {}, children: field } });
		await waitFor(() => expect(document.activeElement).toBe(getByLabelText('q')));
	});

	it('returns focus to the trigger on close', async () => {
		const trigger = document.createElement('button');
		document.body.append(trigger);
		trigger.focus();
		const { rerender } = render(Sheet, { props: { open: true, onclose: () => {}, children: body('x') } });
		await rerender({ open: false });
		expect(document.activeElement).toBe(trigger);
		trigger.remove();
	});

	it('falls back to <main> when the trigger was removed while open', async () => {
		const main = document.createElement('main');
		const row = document.createElement('div');
		const trigger = document.createElement('button');
		row.append(trigger);
		main.append(row);
		document.body.append(main);
		trigger.focus();
		const { rerender } = render(Sheet, { props: { open: true, onclose: () => {}, children: body('x') } });
		row.remove(); // e.g. "Delete set" removed the badge that opened the sheet
		await rerender({ open: false });
		expect(document.activeElement).toBe(main);
		expect(main.getAttribute('tabindex')).toBe('-1');
		main.remove();
	});

	it('prefers a focusable ancestor that is still on the page', async () => {
		const host = document.createElement('div');
		host.tabIndex = 0;
		const row = document.createElement('div');
		const trigger = document.createElement('button');
		row.append(trigger);
		host.append(row);
		document.body.append(host);
		trigger.focus();
		const { rerender } = render(Sheet, { props: { open: true, onclose: () => {}, children: body('x') } });
		row.remove();
		await rerender({ open: false });
		expect(document.activeElement).toBe(host);
		host.remove();
	});
});
