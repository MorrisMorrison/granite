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
