import type { DraftExercise, DraftSet } from '#lib/workoutDraft.ts';

export type { DraftSet };
/** A logger exercise: the persisted draft shape plus last session's sets as placeholder hints (kg). */
export interface LoggerExercise extends DraftExercise {
	prev?: { weight: number | null; reps: number | null }[];
}
