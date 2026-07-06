// Persist an in-progress workout to localStorage so a back-swipe, tab eviction,
// or reload doesn't silently discard the session. The logger page serializes its
// reactive state here on change and offers to restore it on next mount.

const KEY = 'granite.workoutDraft';

export interface DraftSet {
	uid: string;
	set_type: string;
	weight: number | null;
	reps: number | null;
	is_completed: boolean;
}
export interface DraftExercise {
	uid: string;
	exercise_id: string;
	name: string;
	notes?: string;
	rest_seconds?: number;
	sets: DraftSet[];
	// `prev` (last-session hints) is intentionally not persisted — it's re-fetched on load.
}
export interface WorkoutDraft {
	title: string;
	notes: string;
	exercises: DraftExercise[];
	startTime: number;
	fromRoutineId?: string;
}

/** True when the draft holds no actual work — nothing worth persisting/restoring. */
function isEmpty(d: WorkoutDraft): boolean {
	return d.exercises.length === 0;
}

/** Persist the draft. An empty draft (no exercises) clears any stored draft instead. */
export function saveDraft(d: WorkoutDraft): void {
	try {
		if (isEmpty(d)) {
			clearDraft();
			return;
		}
		localStorage.setItem(KEY, JSON.stringify(d));
	} catch {
		// Storage full / unavailable (private mode) — persistence is best-effort.
	}
}

/** Load a persisted draft, or null if none / unparseable / empty. */
export function loadDraft(): WorkoutDraft | null {
	try {
		const raw = localStorage.getItem(KEY);
		if (!raw) return null;
		const d = JSON.parse(raw) as WorkoutDraft;
		if (!d || !Array.isArray(d.exercises) || isEmpty(d)) return null;
		return d;
	} catch {
		return null;
	}
}

/** Drop any persisted draft (on finish, cancel, or discard). */
export function clearDraft(): void {
	try {
		localStorage.removeItem(KEY);
	} catch {
		// ignore
	}
}
