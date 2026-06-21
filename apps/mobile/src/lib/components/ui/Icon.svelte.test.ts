import { render } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import Icon from './Icon.svelte';

describe('Icon', () => {
	it('renders an svg with paths for a known name', () => {
		const { container } = render(Icon, { props: { name: 'plus', size: 32 } });
		const svg = container.querySelector('svg');
		expect(svg).not.toBeNull();
		expect(svg!.getAttribute('width')).toBe('32');
		expect(svg!.getAttribute('height')).toBe('32');
		expect(svg!.querySelector('path')).not.toBeNull();
	});

	it('defaults to size 24', () => {
		const { container } = render(Icon, { props: { name: 'folder' } });
		expect(container.querySelector('svg')!.getAttribute('width')).toBe('24');
	});

	it('renders an empty svg for an unknown name', () => {
		const { container } = render(Icon, { props: { name: 'nope-not-real' } });
		const svg = container.querySelector('svg');
		expect(svg).not.toBeNull();
		expect(svg!.innerHTML).toBe('');
	});
});
