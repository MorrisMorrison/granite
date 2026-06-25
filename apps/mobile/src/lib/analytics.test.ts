import { describe, expect, it } from 'vitest';
import { setsPerMuscleThisWeek, weeklyVolume, type AnalyticsWorkout } from './analytics';

const DAY = 86400000;
const now = new Date(2026, 5, 24, 12).getTime(); // Wed 2026-06-24

const set = (set_type: string, weight: number | null, reps: number | null) => ({ set_type, weight, reps });
const wk = (start: number, exercises: AnalyticsWorkout['exercises']): AnalyticsWorkout => ({
	start_time: start,
	exercises
});

const muscleOf = (id: string) => ({ sq: 'Legs', bn: 'Chest', rw: 'Back' })[id] ?? 'Other';

describe('setsPerMuscleThisWeek', () => {
	it('counts working sets per muscle this week, busiest first, excluding warm-ups', () => {
		const workouts = [
			wk(now, [
				{ exercise_id: 'sq', sets: [set('warmup', 40, 5), set('normal', 100, 5), set('normal', 100, 5)] },
				{ exercise_id: 'bn', sets: [set('normal', 80, 5)] }
			]),
			wk(now - DAY, [{ exercise_id: 'rw', sets: [set('normal', 60, 8), set('normal', 60, 8)] }]),
			wk(now - 21 * DAY, [{ exercise_id: 'sq', sets: [set('normal', 100, 5)] }]) // old week, ignored
		];
		const res = setsPerMuscleThisWeek(workouts, muscleOf, now);
		expect(res).toEqual([
			{ muscle: 'Back', sets: 2 }, // tie (2) broken alphabetically; warm-up set excluded
			{ muscle: 'Legs', sets: 2 },
			{ muscle: 'Chest', sets: 1 }
		]);
	});

	it('is empty with no training this week', () => {
		expect(setsPerMuscleThisWeek([wk(now - 21 * DAY, [])], muscleOf, now)).toEqual([]);
	});

	it('skips warm-up-only exercises and labels unknown muscles "Other"', () => {
		const workouts = [
			wk(now, [
				{ exercise_id: 'xx', sets: [set('warmup', 40, 5)] }, // only warm-up → skipped
				{ exercise_id: 'unk', sets: [set('normal', 50, 5)] } // unknown muscle → Other
			])
		];
		const res = setsPerMuscleThisWeek(workouts, (id) => (id === 'unk' ? '' : 'Legs'), now);
		expect(res).toEqual([{ muscle: 'Other', sets: 1 }]);
	});
});

describe('weeklyVolume', () => {
	it('sums working-set tonnage per week and pads empty weeks', () => {
		const workouts = [
			wk(now, [{ exercise_id: 'sq', sets: [set('warmup', 40, 5), set('normal', 100, 5)] }]), // 500 (warm-up excluded)
			wk(now - 7 * DAY, [{ exercise_id: 'bn', sets: [set('normal', 80, 5)] }]) // 400, last week
		];
		const res = weeklyVolume(workouts, now, 4);
		expect(res).toHaveLength(4);
		expect(res[3].volume).toBe(500); // this week
		expect(res[2].volume).toBe(400); // last week
		expect(res[0].volume).toBe(0); // padded empty week
	});

	it('treats null weight/reps as zero volume', () => {
		const res = weeklyVolume(
			[wk(now, [{ exercise_id: 'x', sets: [set('normal', null, 5), set('normal', 100, null)] }])],
			now,
			1
		);
		expect(res[0].volume).toBe(0);
	});
});
