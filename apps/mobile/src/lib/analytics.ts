// Pure training-analytics helpers (no storage/UI imports) — trivially unit-tested.
// Working sets only (warm-ups are excluded; they aren't training stimulus).

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

const WEEK = 7 * 86400000;
const isWorking = (s: AnalyticsSet) => s.set_type !== 'warmup';

/** Local Monday-midnight for a timestamp (week boundary). */
function mondayOf(ts: number): number {
	const d = new Date(ts);
	d.setHours(0, 0, 0, 0);
	d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
	return d.getTime();
}

/** Working sets per muscle group for the current week, busiest first. */
export function setsPerMuscleThisWeek(
	workouts: AnalyticsWorkout[],
	muscleOf: (exerciseId: string) => string,
	now: number
): MuscleSets[] {
	const thisWeek = mondayOf(now);
	const counts = new Map<string, number>();
	for (const w of workouts) {
		if (mondayOf(w.start_time) !== thisWeek) continue;
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
