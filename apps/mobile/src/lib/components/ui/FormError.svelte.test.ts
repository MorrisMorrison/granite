import { render } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import FormError from './FormError.svelte';

describe('FormError', () => {
	it('renders the message as an alert with an icon', () => {
		const { getByRole } = render(FormError, { props: { message: 'Invalid credentials', testid: 'err' } });
		const el = getByRole('alert');
		expect(el.textContent).toBe('Invalid credentials');
		expect(el.getAttribute('data-testid')).toBe('err');
		expect(el.querySelector('svg')).not.toBeNull();
	});

	it('renders nothing without a message', () => {
		const { queryByRole } = render(FormError, { props: { message: '' } });
		expect(queryByRole('alert')).toBeNull();
	});
});
