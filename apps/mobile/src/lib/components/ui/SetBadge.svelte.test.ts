import { render } from '@testing-library/svelte';
import { fireEvent } from '@testing-library/dom';
import { describe, expect, it, vi } from 'vitest';
import SetBadge from './SetBadge.svelte';

describe('SetBadge', () => {
	it('renders a plain label for a work set', () => {
		const { getByTestId } = render(SetBadge, { props: { label: '2', testid: 'b' } });
		const b = getByTestId('b');
		expect(b.tagName).toBe('SPAN');
		expect(b.textContent).toBe('2');
		expect(b.className).toContain('badge');
		expect(b.className).not.toMatch(/warm|other/);
	});

	it('marks warm-ups amber', () => {
		const { getByTestId } = render(SetBadge, { props: { label: 'W', type: 'warmup', testid: 'b' } });
		expect(getByTestId('b').textContent).toBe('W');
		expect(getByTestId('b').className).toContain('warm');
	});

	it.each([
		['drop', 'D'],
		['failure', 'F']
	])('styles %s sets as the "other" tone', (type, label) => {
		const { getByTestId } = render(SetBadge, { props: { label, type, testid: 'b' } });
		expect(getByTestId('b').textContent).toBe(label);
		expect(getByTestId('b').className).toContain('other');
		expect(getByTestId('b').className).not.toContain('warm');
	});

	it('renders a button with an aria-label when clickable', async () => {
		const onclick = vi.fn();
		const { getByRole } = render(SetBadge, { props: { label: '1', onclick, ariaLabel: 'Set 1 options' } });
		const btn = getByRole('button', { name: 'Set 1 options' });
		await fireEvent.click(btn);
		expect(onclick).toHaveBeenCalledTimes(1);
	});
});
