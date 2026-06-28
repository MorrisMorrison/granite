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

const WEEK = 7 * 86400000;
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

/** Working sets per muscle group for the current week, busiest first. */
export function setsPerMuscleThisWeek(
	workouts: AnalyticsWorkout[],
	muscleOf: (exerciseId: string) => string,
	now: number
): MuscleSets[] {
	return setsPerMuscle(workouts, muscleOf, now, 1);
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
