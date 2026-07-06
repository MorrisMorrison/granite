// Pure training-analytics helpers (no storage/UI imports) — trivially unit-tested.
// Working sets only (warm-ups are excluded; they aren't training stimulus).

import { estimate1RM } from './calc';

interface AnalyticsSet {
	set_type: string;
	weight: number | null;
	reps: number | null;
}
interface AnalyticsExercise {
	exercise_id: string;
	sets: AnalyticsSet[];
}
export interface AnalyticsWorkout {
	start_time: number;
	exercises: AnalyticsExercise[];
}

export interface MuscleSets {
	muscle: string;
	sets: number;
}
export interface WeeklyVolume {
	weekStart: number; // Monday 00:00 local (epoch ms)
	volume: number; // kg (sum of weight × reps over working sets)
}
export interface PersonalRecord {
	exerciseId: string;
	e1rm: number; // new best estimated 1RM (kg, rounded)
	weight: number; // the working set that set it (kg)
	reps: number;
	at: number; // workout start_time (epoch ms)
}
export interface AllTimeRecord {
	exerciseId: string;
	e1rm: number; // best-ever estimated 1RM (kg, rounded)
	weight: number; // the working set that achieved it (kg)
	reps: number;
	at: number; // workout start_time (epoch ms)
}
export interface TopLift {
	exerciseId: string;
	sessions: number; // # sessions with a working set of this lift
	e1rmSeries: number[]; // best working-set e1RM per session, chronological (kg, rounded)
	latestE1rm: number; // most recent session's best e1RM (kg, rounded)
}

const WEEK = 7 * 86400000;
// A working set is a non-warm-up set. Callers pre-filter uncompleted sets (see
// repo/analytics.workoutsForAnalytics), so the shared predicate is completed AND
// not-warmup — the same rule stats.ts and the history detail screen apply.
const isWorking = (s: AnalyticsSet) => s.set_type !== 'warmup';

/** Local Monday-midnight for a timestamp (week boundary). */
function mondayOf(ts: number): number {
	const d = new Date(ts);
	d.setHours(0, 0, 0, 0);
	d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
	return d.getTime();
}

/** Working sets per muscle group over the last `weeks` weeks (including the current
 *  week), busiest first. `weeks = 1` is the current week only. Warm-ups excluded. */
export function setsPerMuscle(
	workouts: AnalyticsWorkout[],
	muscleOf: (exerciseId: string) => string,
	now: number,
	weeks = 1
): MuscleSets[] {
	const currentWeek = mondayOf(now);
	const cutoff = mondayOf(currentWeek - (weeks - 1) * WEEK); // oldest Monday in range
	const counts = new Map<string, number>();
	for (const w of workouts) {
		const wk = mondayOf(w.start_time);
		if (wk < cutoff || wk > currentWeek) continue;
		for (const ex of w.exercises) {
			const n = ex.sets.filter(isWorking).length;
			if (n === 0) continue;
			const m = muscleOf(ex.exercise_id) || 'Other';
			counts.set(m, (counts.get(m) ?? 0) + n);
		}
	}
	return [...counts.entries()]
		.map(([muscle, sets]) => ({ muscle, sets }))
		.sort((a, b) => b.sets - a.sets || a.muscle.localeCompare(b.muscle));
}

/** Total working-set tonnage per week for the last `weeks` weeks (oldest first),
 *  including weeks with no training (volume 0) so the trend is continuous. */
export function weeklyVolume(workouts: AnalyticsWorkout[], now: number, weeks = 12): WeeklyVolume[] {
	const current = mondayOf(now);
	const byWeek = new Map<number, number>();
	for (const w of workouts) {
		const wk = mondayOf(w.start_time);
		let vol = 0;
		for (const ex of w.exercises) {
			for (const s of ex.sets) {
				if (isWorking(s)) vol += (s.weight ?? 0) * (s.reps ?? 0);
			}
		}
		byWeek.set(wk, (byWeek.get(wk) ?? 0) + vol);
	}
	const out: WeeklyVolume[] = [];
	for (let i = weeks - 1; i >= 0; i--) {
		const wk = mondayOf(current - i * WEEK); // re-normalize so DST shifts don't drift the key
		out.push({ weekStart: wk, volume: Math.round(byWeek.get(wk) ?? 0) });
	}
	return out;
}

/** Most recent estimated-1RM personal records across all exercises (newest first).
 *  A PR is a session whose best working-set e1RM beats the exercise's previous best;
 *  the first time an exercise is trained sets a baseline and isn't itself counted. */
export function recentPRs(workouts: AnalyticsWorkout[], limit = 5): PersonalRecord[] {
	const chronological = [...workouts].sort((a, b) => a.start_time - b.start_time);
	const best = new Map<string, number>(); // exerciseId → best e1rm seen so far
	const prs: PersonalRecord[] = [];
	for (const w of chronological) {
		for (const ex of w.exercises) {
			let top: { e1rm: number; weight: number; reps: number } | null = null;
			for (const s of ex.sets) {
				if (!isWorking(s)) continue;
				const weight = s.weight ?? 0;
				const reps = s.reps ?? 0;
				if (weight <= 0 || reps <= 0) continue;
				const e1rm = estimate1RM(weight, reps);
				if (!top || e1rm > top.e1rm) top = { e1rm, weight, reps };
			}
			if (!top) continue;
			const prev = best.get(ex.exercise_id);
			best.set(ex.exercise_id, Math.max(prev ?? 0, top.e1rm));
			if (prev !== undefined && top.e1rm > prev) {
				prs.push({
					exerciseId: ex.exercise_id,
					e1rm: Math.round(top.e1rm),
					weight: top.weight,
					reps: top.reps,
					at: w.start_time
				});
			}
		}
	}
	return prs.sort((a, b) => b.at - a.at).slice(0, limit);
}

/** Best estimated-1RM per exercise across all history, strongest first — a
 *  leaderboard of personal bests. Warm-ups and invalid sets are excluded. */
export function allTimeRecords(workouts: AnalyticsWorkout[], limit = 10): AllTimeRecord[] {
	const best = new Map<string, AllTimeRecord>();
	for (const w of workouts) {
		for (const ex of w.exercises) {
			for (const s of ex.sets) {
				if (!isWorking(s)) continue;
				const weight = s.weight ?? 0;
				const reps = s.reps ?? 0;
				if (weight <= 0 || reps <= 0) continue;
				const e1rm = estimate1RM(weight, reps);
				const cur = best.get(ex.exercise_id);
				if (!cur || e1rm > cur.e1rm) {
					best.set(ex.exercise_id, {
						exerciseId: ex.exercise_id,
						e1rm: Math.round(e1rm),
						weight,
						reps,
						at: w.start_time
					});
				}
			}
		}
	}
	return [...best.values()].sort((a, b) => b.e1rm - a.e1rm).slice(0, limit);
}

/** Most-trained lifts (by session count, strongest as tie-break), each with its
 *  per-session best-e1RM series for a trend sparkline. Only lifts trained in at
 *  least two sessions are included — a trend needs two points. */
export function topLifts(workouts: AnalyticsWorkout[], limit = 5): TopLift[] {
	const chronological = [...workouts].sort((a, b) => a.start_time - b.start_time);
	const series = new Map<string, number[]>();
	for (const w of chronological) {
		for (const ex of w.exercises) {
			let best = 0;
			for (const s of ex.sets) {
				if (!isWorking(s)) continue;
				const weight = s.weight ?? 0;
				const reps = s.reps ?? 0;
				if (weight <= 0 || reps <= 0) continue;
				const e = estimate1RM(weight, reps);
				if (e > best) best = e;
			}
			if (best <= 0) continue;
			const arr = series.get(ex.exercise_id) ?? [];
			arr.push(Math.round(best));
			series.set(ex.exercise_id, arr);
		}
	}
	return [...series.entries()]
		.map(([exerciseId, e1rmSeries]) => ({
			exerciseId,
			sessions: e1rmSeries.length,
			e1rmSeries,
			latestE1rm: e1rmSeries[e1rmSeries.length - 1]
		}))
		.filter((l) => l.sessions >= 2)
		.sort((a, b) => b.sessions - a.sessions || b.latestE1rm - a.latestE1rm)
		.slice(0, limit);
}
