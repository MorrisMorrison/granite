import { render } from '@testing-library/svelte';
import { fireEvent } from '@testing-library/dom';
import { describe, expect, it, vi } from 'vitest';
import SetRow from './SetRow.svelte';

const mk = (over = {}) => ({
	uid: 's1',
	set_type: 'normal',
	weight: 60,
	reps: 5,
	is_completed: false,
	...over
});

describe('SetRow', () => {
	it('shows the badge, previous text and an unchecked done checkbox', () => {
		const { getByTestId } = render(SetRow, {
			props: { set: mk(), badge: '2', previous: '60 × 5', onbadge: () => {}, ontoggle: () => {} }
		});
		expect(getByTestId('set-label').textContent).toBe('2');
		expect(getByTestId('set-row').textContent).toContain('60 × 5');
		expect(getByTestId('set-complete').getAttribute('role')).toBe('checkbox');
		expect(getByTestId('set-complete').getAttribute('aria-label')).toBe('Set 2 done');
		expect(getByTestId('set-complete').getAttribute('aria-checked')).toBe('false');
	});

	it('reflects completion and marks warm-ups', () => {
		const { getByTestId } = render(SetRow, {
			props: {
				set: mk({ is_completed: true, set_type: 'warmup' }),
				badge: 'W',
				onbadge: () => {},
				ontoggle: () => {}
			}
		});
		expect(getByTestId('set-complete').getAttribute('aria-checked')).toBe('true');
		expect(getByTestId('set-complete').getAttribute('aria-label')).toBe('Warm-up set done');
		expect(getByTestId('set-label').className).toContain('warm');
	});

	it('fires ontoggle and onbadge', async () => {
		const ontoggle = vi.fn();
		const onbadge = vi.fn();
		const { getByTestId } = render(SetRow, { props: { set: mk(), badge: '1', onbadge, ontoggle } });
		await fireEvent.click(getByTestId('set-complete'));
		await fireEvent.click(getByTestId('set-label'));
		expect(ontoggle).toHaveBeenCalledTimes(1);
		expect(onbadge).toHaveBeenCalledTimes(1);
	});
});
