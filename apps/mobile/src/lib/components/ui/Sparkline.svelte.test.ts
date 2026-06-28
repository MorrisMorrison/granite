import { render } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import Sparkline from './Sparkline.svelte';

describe('Sparkline', () => {
	it('draws a path through the values', () => {
		const { container } = render(Sparkline, { props: { values: [10, 20, 15] } });
		const path = container.querySelector('path');
		expect(path).not.toBeNull();
		expect(path?.getAttribute('d')?.startsWith('M')).toBe(true);
	});

	it('renders nothing with fewer than two points', () => {
		const { container } = render(Sparkline, { props: { values: [10] } });
		expect(container.querySelector('svg')).toBeNull();
	});

	it('handles a flat series (all values equal)', () => {
		const { container } = render(Sparkline, { props: { values: [10, 10, 10] } });
		expect(container.querySelector('path')?.getAttribute('d')).toContain('M');
	});
});
