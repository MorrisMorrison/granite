import { render } from '@testing-library/svelte';
import { fireEvent } from '@testing-library/dom';
import { describe, expect, it, vi } from 'vitest';
import RestCard from './RestCard.svelte';

const noop = () => {};

describe('RestCard', () => {
	it('renders the REST label and the m:ss time', () => {
		const { getByTestId, getByText } = render(RestCard, {
			props: { remaining: 95, total: 120, onbump: noop, onskip: noop }
		});
		expect(getByTestId('rest-time').textContent).toBe('1:35');
		expect(getByText('Rest')).toBeTruthy();
	});

	it('fills the ring by the fraction of rest left, clamped to full', async () => {
		const offset = (el: HTMLElement) => Number(el.getAttribute('stroke-dashoffset'));
		const { getByTestId, rerender } = render(RestCard, {
			props: { remaining: 60, total: 120, onbump: noop, onskip: noop }
		});
		const ring = getByTestId('rest-progress');
		const full = Number(ring.getAttribute('stroke-dasharray'));
		expect(offset(ring)).toBeCloseTo(full / 2);
		await rerender({ remaining: 200, total: 120 });
		expect(offset(ring)).toBeCloseTo(0);
		await rerender({ remaining: 0, total: 120 });
		expect(offset(ring)).toBeCloseTo(full);
	});

	it('fires bump(-15), bump(15) and skip', async () => {
		const onbump = vi.fn();
		const onskip = vi.fn();
		const { getByRole } = render(RestCard, {
			props: { remaining: 30, total: 90, onbump, onskip }
		});
		await fireEvent.click(getByRole('button', { name: 'Subtract 15 seconds' }));
		await fireEvent.click(getByRole('button', { name: 'Add 15 seconds' }));
		await fireEvent.click(getByRole('button', { name: 'Skip' }));
		expect(onbump.mock.calls).toEqual([[-15], [15]]);
		expect(onskip).toHaveBeenCalledTimes(1);
	});
});
