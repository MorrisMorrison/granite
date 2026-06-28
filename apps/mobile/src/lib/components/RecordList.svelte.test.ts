import { render } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import RecordList from './RecordList.svelte';

const rows = [{ exerciseId: 'sq', exerciseName: 'Squat', weight: 100, reps: 5, e1rm: 113, at: Date.now() }];

describe('RecordList', () => {
	it('renders a row per record with weight × reps and e1RM in the display unit', () => {
		const { getAllByTestId, container } = render(RecordList, { props: { rows, unit: 'kg' } });
		expect(getAllByTestId('record-row')).toHaveLength(1);
		const text = container.textContent ?? '';
		expect(text).toContain('100 kg × 5');
		expect(text).toContain('113 kg'); // trailing e1RM
	});

	it('honours a custom rowTestid', () => {
		const { getByTestId } = render(RecordList, { props: { rows, unit: 'lb', rowTestid: 'pr-row' } });
		expect(getByTestId('pr-row')).toBeTruthy();
	});
});
