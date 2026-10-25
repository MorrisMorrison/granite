import { render } from '@testing-library/svelte';
import { fireEvent } from '@testing-library/dom';
import { createRawSnippet } from 'svelte';
import { describe, expect, it, vi } from 'vitest';
import FolderGroup from './FolderGroup.svelte';

const rows = createRawSnippet(() => ({ render: () => '<p data-testid="inner">row</p>' }));

describe('FolderGroup', () => {
	it('renders name, count and rows; toggles on click', async () => {
		const ontoggle = vi.fn();
		const { getByTestId, getByText } = render(FolderGroup, {
			props: { name: 'Strength', count: 2, ontoggle, testid: 'folder', children: rows }
		});
		expect(getByText('Strength')).toBeTruthy();
		expect(getByTestId('inner')).toBeTruthy();
		await fireEvent.click(getByTestId('folder-toggle'));
		expect(ontoggle).toHaveBeenCalled();
	});

	it('hides rows when collapsed and shows the empty hint when empty', () => {
		const a = render(FolderGroup, { props: { name: 'A', ontoggle: () => {}, collapsed: true, children: rows } });
		expect(a.queryByTestId('inner')).toBeNull();
		a.unmount();
		const b = render(FolderGroup, { props: { name: 'B', empty: true, children: rows } });
		expect(b.getByText('Empty — move a routine here.')).toBeTruthy();
	});

	it('opens a menu with Rename folder / Delete folder', async () => {
		const onrename = vi.fn();
		const ondelete = vi.fn();
		const { getByRole } = render(FolderGroup, {
			props: { name: 'A', ontoggle: () => {}, onrename, ondelete, children: rows }
		});
		await fireEvent.click(getByRole('button', { name: 'Folder actions' }));
		await fireEvent.click(getByRole('button', { name: 'Rename folder' }));
		expect(onrename).toHaveBeenCalled();
		await fireEvent.click(getByRole('button', { name: 'Folder actions' }));
		await fireEvent.click(getByRole('button', { name: 'Delete folder' }));
		expect(ondelete).toHaveBeenCalled();
	});
});
