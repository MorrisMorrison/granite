import { render } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import Sparkline from './Sparkline.svelte';

describe('Sparkline', () => {
	it('draws an area + line and marks the latest point', () => {
		const { container } = render(Sparkline, { props: { values: [10, 20, 15] } });
		const paths = container.querySelectorAll('path');
		expect(paths).toHaveLength(2); // area fill + line
		expect(paths[1].getAttribute('d')?.startsWith('M')).toBe(true);
		expect(container.querySelectorAll('circle')).toHaveLength(1); // latest point
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
