// Pure month-calendar helpers (no storage/UI imports) — drive the reusable
// Calendar component and are trivially unit-testable. Weeks are Monday-start.

export interface CalendarCell {
	day: number; // 1-based day of month
	ms: number; // local start-of-day timestamp
}

/** Local start-of-day for a timestamp. */
export function startOfDay(ms: number): number {
	const d = new Date(ms);
	d.setHours(0, 0, 0, 0);
	return d.getTime();
}

/** "June 2026" for the given year + 0-based month. */
export function monthLabel(year: number, month: number): string {
	return new Date(year, month, 1).toLocaleDateString(undefined, {
		month: 'long',
		year: 'numeric'
	});
}

/** Leading blank count (Monday-start) and the day cells for a month. */
export function monthGrid(year: number, month: number): { lead: number; days: CalendarCell[] } {
	const lead = (new Date(year, month, 1).getDay() + 6) % 7; // Mon=0 … Sun=6
	const count = new Date(year, month + 1, 0).getDate();
	const days: CalendarCell[] = [];
	for (let d = 1; d <= count; d++) days.push({ day: d, ms: new Date(year, month, d).getTime() });
	return { lead, days };
}

/** Day numbers within (year, month) that have at least one timestamp. */
export function markedDays(dates: number[], year: number, month: number): Set<number> {
	const s = new Set<number>();
	for (const ms of dates) {
		const d = new Date(ms);
		if (d.getFullYear() === year && d.getMonth() === month) s.add(d.getDate());
	}
	return s;
}

/** How many timestamps fall within (year, month). */
export function countInMonth(dates: number[], year: number, month: number): number {
	return dates.filter((ms) => {
		const d = new Date(ms);
		return d.getFullYear() === year && d.getMonth() === month;
	}).length;
}

/** True if (year, month) is strictly after the month containing `now` (no future browsing). */
export function isAfterMonth(year: number, month: number, now: number): boolean {
	const n = new Date(now);
	return year > n.getFullYear() || (year === n.getFullYear() && month > n.getMonth());
}

/** Shift a (year, month) by `delta` months, normalizing the year. */
export function addMonth(year: number, month: number, delta: number): { year: number; month: number } {
	const d = new Date(year, month + delta, 1);
	return { year: d.getFullYear(), month: d.getMonth() };
}
