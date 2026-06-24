import { render } from '@testing-library/svelte';
import { fireEvent } from '@testing-library/dom';
import { describe, expect, it, vi } from 'vitest';
import Calendar from './Calendar.svelte';
import { startOfDay } from '$lib/calendar';

// A day in the current month (small day numbers are safe for every month).
const thisMonth = (day: number) => {
	const d = new Date();
	d.setDate(day);
	d.setHours(12, 0, 0, 0);
	return d.getTime();
};

describe('Calendar', () => {
	it('shows the month workout count and marks those days', () => {
		const { getByTestId, getAllByTestId } = render(Calendar, {
			props: { dates: [thisMonth(5), thisMonth(12)] }
		});
		expect(getByTestId('cal-title').textContent).toMatch(/2 workouts/);
		expect(getAllByTestId('cal-day-marked')).toHaveLength(2);
	});

	it('disables next on the current month, enables it after paging back', async () => {
		const { getByTestId } = render(Calendar, { props: { dates: [] } });
		expect((getByTestId('cal-next') as HTMLButtonElement).disabled).toBe(true);

		await fireEvent.click(getByTestId('cal-prev'));
		expect((getByTestId('cal-next') as HTMLButtonElement).disabled).toBe(false);
	});

	it('selects a marked day via onselect', async () => {
		const onselect = vi.fn();
		const day = thisMonth(8);
		const { getAllByTestId } = render(Calendar, { props: { dates: [day], onselect } });

		await fireEvent.click(getAllByTestId('cal-day-marked')[0]);
		expect(onselect).toHaveBeenCalledWith(startOfDay(day));
	});

	it('toggles off when the already-selected day is tapped again', async () => {
		const onselect = vi.fn();
		const day = thisMonth(8);
		const { getAllByTestId } = render(Calendar, {
			props: { dates: [day], selected: startOfDay(day), onselect }
		});

		await fireEvent.click(getAllByTestId('cal-day-marked')[0]);
		expect(onselect).toHaveBeenCalledWith(null);
	});
});
