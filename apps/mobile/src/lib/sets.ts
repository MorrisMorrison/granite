// Shared set-type vocabulary + display helper, used by the logger, routine form,
// and workout detail so they stay consistent.

/** Selectable set types. "normal" is a plain work set; the rest are labels. */
export const SET_TYPES = ['normal', 'warmup', 'top', 'backoff', 'drop', 'failure'] as const;
export type SetType = (typeof SET_TYPES)[number];

/**
 * Display label for a set row: "W" for a warm-up, otherwise its running work-set
 * number (warm-ups don't count toward it). So a 2-warmup, 3-work block reads
 * W, W, 1, 2, 3.
 */
export function setLabel(sets: { set_type: string }[], i: number): string {
	if (sets[i]?.set_type === 'warmup') return 'W';
	let n = 0;
	for (let j = 0; j <= i; j++) if (sets[j].set_type !== 'warmup') n++;
	return String(n);
}
