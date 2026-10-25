// Convert between a total seconds value (how rest is stored) and a minutes/seconds
// split (how it's edited). Pure + tested; the RestInput component is a thin shell.

export function splitDuration(totalSec: number | null | undefined): { min: number; sec: number } {
	const t = Math.max(0, Math.floor(totalSec ?? 0));
	return { min: Math.floor(t / 60), sec: t % 60 };
}

export function joinDuration(min: number | null | undefined, sec: number | null | undefined): number {
	const m = Math.max(0, Math.floor(min ?? 0));
	const s = Math.min(59, Math.max(0, Math.floor(sec ?? 0)));
	return m * 60 + s;
}

/** Elapsed workout clock: `mm:ss`, or `h:mm:ss` past an hour. */
export function formatElapsed(ms: number): string {
	const t = Math.max(0, Math.floor(ms / 1000));
	const h = Math.floor(t / 3600);
	const m = Math.floor((t % 3600) / 60);
	const s = String(t % 60).padStart(2, '0');
	return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${String(m).padStart(2, '0')}:${s}`;
}

/** Rest countdown: `m:ss`. */
export function formatRest(totalSec: number): string {
	const t = Math.max(0, Math.floor(totalSec));
	return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}

/** Whole minutes a workout lasted, or null while it has no end (or under half a minute). */
export function workoutMinutes(start: number, end: number | null | undefined): number | null {
	if (!end) return null;
	const m = Math.round((end - start) / 60000);
	return m > 0 ? m : null;
}
