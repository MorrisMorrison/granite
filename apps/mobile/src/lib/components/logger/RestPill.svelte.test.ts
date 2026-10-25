import { render } from '@testing-library/svelte';
import { fireEvent } from '@testing-library/dom';
import { describe, expect, it, vi } from 'vitest';
import RestPill from './RestPill.svelte';

describe('RestPill', () => {
	it('renders the REST label and the m:ss time', () => {
		const { getByTestId, getByText } = render(RestPill, {
			props: { remaining: 95, onbump: () => {}, onskip: () => {} }
		});
		expect(getByTestId('rest-time').textContent).toBe('1:35');
		expect(getByText('Rest')).toBeTruthy();
	});

	it('fires bump(-15), bump(15) and skip', async () => {
		const onbump = vi.fn();
		const onskip = vi.fn();
		const { getByText } = render(RestPill, { props: { remaining: 30, onbump, onskip } });
		await fireEvent.click(getByText('−15'));
		await fireEvent.click(getByText('+15'));
		await fireEvent.click(getByText('Skip'));
		expect(onbump.mock.calls).toEqual([[-15], [15]]);
		expect(onskip).toHaveBeenCalledTimes(1);
	});
});
