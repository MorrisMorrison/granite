// Pure progress/PR aggregation over workout records — no storage imports, so it's
// trivially unit-testable. The store wrapper lives in $lib/repo/stats.

/** Per-session aggregates for one exercise (weights in kg, as stored). */
export interface SessionStat {
	workout_id: string;
	date: number; // workout start_time (epoch ms)
	top_weight: number | null; // heaviest weight lifted that session
	top_reps: number | null; // reps at that heaviest set
	best_1rm: number | null; // best estimated 1RM (Epley), kg
	volume: number; // sum(weight × reps) over completed working (non-warm-up) sets, kg
}

export interface ExerciseProgress {
	sessions: SessionStat[]; // chronological (oldest first)
	pr_weight: number | null;
	pr_weight_reps: number | null;
	pr_1rm: number | null;
	pr_volume: number | null;
	total_sessions: number;
}

interface SetData {
	weight: number | null;
	reps: number | null;
	set_type?: string;
	is_completed?: boolean;
}
interface WorkoutData {
	start_time?: number;
	exercises?: { exercise_id: string; sets?: SetData[] }[];
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** The completed sets from the most recent prior session of an exercise (kg). */
export interface LastPerformance {
	date: number;
	sets: { weight: number | null; reps: number | null }[];
}

/** The most recent session (by start_time) in which the exercise had completed sets. */
export function computeLastPerformance(
	records: { id: string; data: unknown }[],
	exerciseId: string
): LastPerformance | null {
	let best: LastPerformance | null = null;
	for (const rec of records) {
		const d = rec.data as WorkoutData;
		const matches = (d.exercises ?? []).filter((e) => e.exercise_id === exerciseId);
		if (matches.length === 0) continue;
		const sets: { weight: number | null; reps: number | null }[] = [];
		for (const ex of matches) {
			for (const s of ex.sets ?? []) {
				if (s.is_completed === false) continue;
				sets.push({ weight: s.weight ?? null, reps: s.reps ?? null });
			}
		}
		if (sets.length === 0) continue;
		const date = d.start_time ?? 0;
		if (best === null || date > best.date) best = { date, sets };
	}
	return best;
}

/** Aggregate per-session stats + PRs for one exercise from raw workout records. */
export function computeExerciseProgress(
	records: { id: string; data: unknown }[],
	exerciseId: string
): ExerciseProgress {
	const sessions: SessionStat[] = [];

	for (const rec of records) {
		const d = rec.data as WorkoutData;
		const matches = (d.exercises ?? []).filter((e) => e.exercise_id === exerciseId);
		if (matches.length === 0) continue;

		let topWeight: number | null = null;
		let topReps: number | null = null;
		let best1rm: number | null = null;
		let volume = 0;
		let counted = false;

		for (const ex of matches) {
			for (const s of ex.sets ?? []) {
				if (s.is_completed === false) continue; // completed sets only (undefined counts)
				counted = true;
				// Volume is working-set tonnage only — warm-ups don't count (matches analytics.ts).
				if (s.set_type !== 'warmup' && s.weight != null && s.reps != null)
					volume += s.weight * s.reps;
				if (s.weight != null && (topWeight == null || s.weight > topWeight)) {
					topWeight = s.weight;
					topReps = s.reps;
				}
				if (s.weight != null && s.reps != null) {
					const e1rm = s.weight * (1 + s.reps / 30); // Epley
					if (best1rm == null || e1rm > best1rm) best1rm = e1rm;
				}
			}
		}
		if (!counted) continue;

		sessions.push({
			workout_id: rec.id,
			date: d.start_time ?? 0,
			top_weight: topWeight,
			top_reps: topReps,
			best_1rm: best1rm == null ? null : round1(best1rm),
			volume: round1(volume)
		});
	}

	sessions.sort((a, b) => a.date - b.date);

	let prWeight: number | null = null;
	let prWeightReps: number | null = null;
	let pr1rm: number | null = null;
	let prVolume: number | null = null;
	for (const s of sessions) {
		if (s.top_weight != null && (prWeight == null || s.top_weight > prWeight)) {
			prWeight = s.top_weight;
			prWeightReps = s.top_reps;
		}
		if (s.best_1rm != null && (pr1rm == null || s.best_1rm > pr1rm)) pr1rm = s.best_1rm;
		if (s.volume > 0 && (prVolume == null || s.volume > prVolume)) prVolume = s.volume;
	}

	return {
		sessions,
		pr_weight: prWeight,
		pr_weight_reps: prWeightReps,
		pr_1rm: pr1rm,
		pr_volume: prVolume,
		total_sessions: sessions.length
	};
}

/** At-a-glance training stats for the home screen, from workout start times. */
export interface HomeStats {
	total: number; // lifetime workouts
	thisWeek: number; // workouts in the current (Mon-start) week
	streakWeeks: number; // consecutive weeks with ≥1 workout (current week optional)
	lastWorkoutAt: number | null; // most recent start_time, or null
}

// Local Monday-midnight for a timestamp (week boundary).
function mondayOf(ts: number): number {
	const d = new Date(ts);
	d.setHours(0, 0, 0, 0);
	const dow = (d.getDay() + 6) % 7; // Mon=0 … Sun=6
	d.setDate(d.getDate() - dow);
	return d.getTime();
}
function prevWeek(mondayMs: number): number {
	const d = new Date(mondayMs);
	d.setDate(d.getDate() - 7); // DST-safe: still lands on the previous Monday midnight
	return d.getTime();
}

/**
 * Summarize training cadence from workout start times. The streak counts back from
 * the current week; an untrained current (in-progress) week doesn't break it — the
 * count simply resumes from last week.
 */
export function computeHomeStats(workouts: { start_time: number }[], now: number): HomeStats {
	const valid = workouts.filter((w) => w.start_time > 0);
	const weeks = new Set(valid.map((w) => mondayOf(w.start_time)));
	const thisMonday = mondayOf(now);

	let cursor = weeks.has(thisMonday) ? thisMonday : prevWeek(thisMonday);
	let streakWeeks = 0;
	while (weeks.has(cursor)) {
		streakWeeks++;
		cursor = prevWeek(cursor);
	}

	return {
		total: valid.length,
		thisWeek: valid.filter((w) => mondayOf(w.start_time) === thisMonday).length,
		streakWeeks,
		lastWorkoutAt: valid.length ? Math.max(...valid.map((w) => w.start_time)) : null
	};
}
