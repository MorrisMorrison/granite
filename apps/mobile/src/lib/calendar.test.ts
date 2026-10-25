import { describe, expect, it } from 'vitest';
import {
	addMonth,
	countInMonth,
	groupByMonth,
	isAfterMonth,
	markedDays,
	monthGrid,
	monthLabel,
	startOfDay
} from './calendar';

describe('monthGrid', () => {
	it('lays out June 2026 (Mon-start, 30 days, leads on Monday)', () => {
		const g = monthGrid(2026, 5); // June = month 5
		expect(g.days).toHaveLength(30);
		expect(g.days[0].day).toBe(1);
		expect(g.lead).toBe(0); // June 1 2026 is a Monday
	});

	it('computes the leading blanks for a mid-week start', () => {
		// Feb 2026 starts on a Sunday → 6 leading blanks (Mon-start).
		expect(monthGrid(2026, 1).lead).toBe(6);
		expect(monthGrid(2026, 1).days).toHaveLength(28);
	});
});

describe('markedDays + countInMonth', () => {
	const jun = (d: number) => new Date(2026, 5, d, 12).getTime();
	const dates = [jun(2), jun(2), jun(20), new Date(2026, 4, 10).getTime()]; // two on the 2nd, one in May

	it('marks distinct days within the month', () => {
		const m = markedDays(dates, 2026, 5);
		expect([...m].sort((a, b) => a - b)).toEqual([2, 20]);
	});

	it('counts all sessions in the month (not distinct days)', () => {
		expect(countInMonth(dates, 2026, 5)).toBe(3); // two on the 2nd + one on the 20th
		expect(countInMonth(dates, 2026, 4)).toBe(1); // May
	});
});

describe('isAfterMonth', () => {
	const now = new Date(2026, 5, 24).getTime(); // June 2026
	it('flags future months, not the current or past ones', () => {
		expect(isAfterMonth(2026, 6, now)).toBe(true); // July
		expect(isAfterMonth(2027, 0, now)).toBe(true); // next year
		expect(isAfterMonth(2026, 5, now)).toBe(false); // current
		expect(isAfterMonth(2026, 4, now)).toBe(false); // May
	});
});

describe('addMonth', () => {
	it('steps and wraps the year', () => {
		expect(addMonth(2026, 5, 1)).toEqual({ year: 2026, month: 6 });
		expect(addMonth(2026, 0, -1)).toEqual({ year: 2025, month: 11 });
		expect(addMonth(2026, 11, 1)).toEqual({ year: 2027, month: 0 });
	});
});

describe('startOfDay + monthLabel', () => {
	it('zeroes the time', () => {
		const noon = new Date(2026, 5, 24, 13, 30).getTime();
		expect(new Date(startOfDay(noon)).getHours()).toBe(0);
	});
	it('labels the month', () => {
		expect(monthLabel(2026, 5)).toMatch(/2026/);
	});
});

describe('groupByMonth', () => {
	const at = (y: number, m: number, d: number, h = 12, min = 0) => ({
		start_time: new Date(y, m, d, h, min).getTime()
	});

	it('groups newest-first input into newest-first months, keeping order inside each', () => {
		const items = [at(2026, 9, 21), at(2026, 9, 3), at(2026, 8, 30), at(2026, 7, 1)];
		const g = groupByMonth(items);
		expect(g.map((x) => x.key)).toEqual(['2026-10', '2026-09', '2026-08']);
		expect(g[0].items).toEqual([items[0], items[1]]);
		expect(g[1].items).toEqual([items[2]]);
		expect(g[0].label).toBe(monthLabel(2026, 9));
		expect(g[0]).toMatchObject({ year: 2026, month: 9 });
	});

	it('splits on local month boundaries (late night vs. just after midnight)', () => {
		const lastNight = at(2026, 9, 31, 23, 59); // 31 Oct, 23:59 local
		const firstMorning = at(2026, 10, 1, 0, 1); // 1 Nov, 00:01 local
		const g = groupByMonth([firstMorning, lastNight]);
		expect(g.map((x) => x.key)).toEqual(['2026-11', '2026-10']);
	});

	it('crosses a year boundary', () => {
		const g = groupByMonth([at(2027, 0, 2), at(2026, 11, 30)]);
		expect(g.map((x) => x.key)).toEqual(['2027-01', '2026-12']);
	});

	it('returns no groups for no items', () => {
		expect(groupByMonth([])).toEqual([]);
	});
});
