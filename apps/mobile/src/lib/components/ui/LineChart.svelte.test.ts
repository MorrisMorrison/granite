import { render } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import LineChart from './LineChart.svelte';

describe('LineChart', () => {
	it('plots one dot per value and draws a polyline through them', () => {
		const { container } = render(LineChart, { props: { values: [10, 20, 30], label: 'e1RM' } });
		expect(container.querySelectorAll('circle')).toHaveLength(3);
		const path = container.querySelector('path')!;
		expect(path.getAttribute('d')).toMatch(/^M/); // moves to the first point
		expect(path.getAttribute('d')).toContain('L'); // then lines to the rest
		expect(container.querySelector('svg')!.getAttribute('aria-label')).toBe('e1RM');
	});

	it('renders nothing plottable for an empty series', () => {
		const { container } = render(LineChart, { props: { values: [] } });
		expect(container.querySelectorAll('circle')).toHaveLength(0);
		expect(container.querySelector('path')!.getAttribute('d')).toBe('');
	});

	it('centers a single value', () => {
		const { container } = render(LineChart, { props: { values: [42] } });
		const dots = container.querySelectorAll('circle');
		expect(dots).toHaveLength(1);
		expect(dots[0].getAttribute('cx')).toBe('160'); // W / 2
	});
});
