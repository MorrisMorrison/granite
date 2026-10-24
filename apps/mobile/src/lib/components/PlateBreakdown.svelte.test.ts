import { render } from '@testing-library/svelte';
import { fireEvent } from '@testing-library/dom';
import { describe, expect, it } from 'vitest';
import PlateBreakdown from './PlateBreakdown.svelte';

const result = (el: HTMLElement) => el.textContent!.replace(/\s+/g, ' ').trim();

describe('PlateBreakdown', () => {
	it('prompts for a weight when there is none', () => {
		const { getByTestId, queryByTestId } = render(PlateBreakdown, { props: { unit: 'kg' } });
		expect(result(getByTestId('plate-result'))).toBe('Enter a weight.');
		expect(queryByTestId('plate-diagram')).toBeNull();
	});

	it('shows the per-side breakdown and one diagram plate per plate', () => {
		const { getByTestId } = render(PlateBreakdown, { props: { unit: 'kg', total: 65 } });
		expect(result(getByTestId('plate-result'))).toBe('Each side 20 + 2.5');
		expect(getByTestId('plate-diagram').querySelectorAll('.plate')).toHaveLength(2);
	});

	it('reports what it cannot load exactly', () => {
		// (101 - 20) / 2 = 40.5 per side -> 25 + 15, 0.5 short.
		const { getByTestId } = render(PlateBreakdown, { props: { unit: 'kg', total: 101 } });
		expect(result(getByTestId('plate-result'))).toBe('Each side 25 + 15 · 0.5 kg short');
	});

	it('groups repeated plates', () => {
		const { getByTestId } = render(PlateBreakdown, { props: { unit: 'kg', total: 120 } });
		expect(result(getByTestId('plate-result'))).toBe('Each side 2×25');
	});

	it('shows just the bar', () => {
		const { getByTestId } = render(PlateBreakdown, { props: { unit: 'kg', total: 20 } });
		expect(result(getByTestId('plate-result'))).toBe('Just the bar.');
	});

	it('flags a total below the bar, without a diagram', () => {
		const { getByTestId, queryByTestId } = render(PlateBreakdown, { props: { unit: 'kg', total: 15 } });
		expect(result(getByTestId('plate-result'))).toBe('Below the bar weight.');
		expect(queryByTestId('plate-diagram')).toBeNull();
	});

	it('steps the total by one plate pair per unit', async () => {
		const { getByTestId, getByLabelText } = render(PlateBreakdown, { props: { unit: 'kg', total: 60 } });
		const total = getByTestId('field-plate-target') as HTMLInputElement;

		await fireEvent.click(getByLabelText('Plus 2.5 kg'));
		expect(total.value).toBe('62.5');
		await fireEvent.click(getByLabelText('Minus 2.5 kg'));
		await fireEvent.click(getByLabelText('Minus 2.5 kg'));
		expect(total.value).toBe('57.5');
	});

	it('uses a bar override and lb plates', async () => {
		const { getByTestId } = render(PlateBreakdown, { props: { unit: 'lb', total: 135 } });
		expect(result(getByTestId('plate-result'))).toBe('Each side 45');

		await fireEvent.input(getByTestId('field-plate-bar'), { target: { value: '35' } });
		expect(result(getByTestId('plate-result'))).toBe('Each side 45 + 5');
	});
});
