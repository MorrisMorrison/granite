import { render } from '@testing-library/svelte';
import { fireEvent } from '@testing-library/dom';
import { describe, expect, it } from 'vitest';
import RestInput from './RestInput.svelte';

describe('RestInput', () => {
	it('shows minutes + seconds split from the seconds value', () => {
		const { getByLabelText } = render(RestInput, { props: { value: 210 } });
		expect((getByLabelText('Rest minutes') as HTMLInputElement).value).toBe('3');
		expect((getByLabelText('Rest seconds') as HTMLInputElement).value).toBe('30');
	});

	it('clamps seconds to 59 on commit', async () => {
		const { getByLabelText } = render(RestInput, { props: { value: 60 } });
		const sec = getByLabelText('Rest seconds') as HTMLInputElement;
		await fireEvent.input(sec, { target: { value: '90' } });
		await fireEvent.change(sec);
		expect(sec.value).toBe('59');
	});

	it('reflects a minutes change back through the bound value', async () => {
		const { getByLabelText } = render(RestInput, { props: { value: 0 } });
		const min = getByLabelText('Rest minutes') as HTMLInputElement;
		await fireEvent.input(min, { target: { value: '2' } });
		await fireEvent.change(min);
		expect(min.value).toBe('2');
		expect((getByLabelText('Rest seconds') as HTMLInputElement).value).toBe('0');
	});

	it('renders testid-suffixed inputs when given a testid', () => {
		const { getByTestId } = render(RestInput, { props: { value: 0, testid: 'field-rest' } });
		expect(getByTestId('field-rest-min')).toBeTruthy();
		expect(getByTestId('field-rest-sec')).toBeTruthy();
	});
});
