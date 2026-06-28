import { render } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import LineChart from './LineChart.svelte';

describe('LineChart', () => {
	it('marks only the latest point and draws a filled area + line', () => {
		const { container } = render(LineChart, { props: { values: [10, 20, 30], label: 'e1RM' } });
		expect(container.querySelectorAll('circle')).toHaveLength(1); // only the latest point
		const paths = container.querySelectorAll('path');
		expect(paths).toHaveLength(2); // area fill + line
		expect(paths[0].getAttribute('d')).toContain('Z'); // area is closed
		expect(paths[1].getAttribute('d')).toMatch(/^M/); // line moves to the first point
		expect(paths[1].getAttribute('d')).toContain('L'); // then lines to the rest
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
