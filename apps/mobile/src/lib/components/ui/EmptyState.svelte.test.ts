import { render } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import { describe, expect, it } from 'vitest';
import EmptyState from './EmptyState.svelte';

const snip = (t: string) => createRawSnippet(() => ({ render: () => `<span>${t}</span>` }));

describe('EmptyState', () => {
	it('renders title and description', () => {
		const { getByText } = render(EmptyState, {
			props: { title: 'No workouts yet', description: 'Logged sessions show up here.' }
		});
		expect(getByText('No workouts yet')).toBeTruthy();
		expect(getByText('Logged sessions show up here.')).toBeTruthy();
	});

	it('omits the description when not provided', () => {
		const { container } = render(EmptyState, { props: { title: 'Empty' } });
		expect(container.querySelector('.empty-desc')).toBeNull();
	});

	it('renders an action snippet', () => {
		const { getByText } = render(EmptyState, { props: { title: 'X', action: snip('Add') } });
		expect(getByText('Add')).toBeTruthy();
	});
});
