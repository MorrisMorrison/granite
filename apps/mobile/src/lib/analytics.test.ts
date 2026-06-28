import { describe, expect, it } from 'vitest';
import {
	setsPerMuscle,
	setsPerMuscleThisWeek,
	weeklyVolume,
	recentPRs,
	allTimeRecords,
	topLifts,
	type AnalyticsWorkout
} from './analytics';

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

describe('setsPerMuscle (windowed)', () => {
	const workouts = [
		wk(now, [{ exercise_id: 'sq', sets: [set('normal', 100, 5), set('normal', 100, 5)] }]), // this week: 2 Legs
		wk(now - 7 * DAY, [{ exercise_id: 'bn', sets: [set('normal', 80, 5)] }]), // last week: 1 Chest
		wk(now - 21 * DAY, [{ exercise_id: 'sq', sets: [set('normal', 100, 5)] }]) // 3 weeks ago: 1 Legs
	];

	it('counts only the last N weeks, excluding older weeks', () => {
		expect(setsPerMuscle(workouts, muscleOf, now, 2)).toEqual([
			{ muscle: 'Legs', sets: 2 },
			{ muscle: 'Chest', sets: 1 }
		]);
	});

	it('widens to include older weeks as the window grows', () => {
		expect(setsPerMuscle(workouts, muscleOf, now, 4)).toEqual([
			{ muscle: 'Legs', sets: 3 }, // this week (2) + 3 weeks ago (1)
			{ muscle: 'Chest', sets: 1 }
		]);
	});

	it('excludes future-dated workouts', () => {
		expect(setsPerMuscle([wk(now + 14 * DAY, [{ exercise_id: 'sq', sets: [set('normal', 100, 5)] }])], muscleOf, now, 8)).toEqual([]);
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

describe('recentPRs', () => {
	it('reports estimated-1RM improvements (not first sessions), newest first, warm-ups excluded', () => {
		const workouts = [
			wk(now - 21 * DAY, [{ exercise_id: 'sq', sets: [set('normal', 100, 5)] }]), // baseline
			wk(now - 14 * DAY, [
				{ exercise_id: 'sq', sets: [set('normal', 100, 5)] }, // no improvement
				{ exercise_id: 'bn', sets: [set('normal', 80, 5)] } // baseline
			]),
			wk(now - 7 * DAY, [
				{ exercise_id: 'sq', sets: [set('warmup', 200, 1), set('normal', 110, 5)] } // PR (warm-up ignored)
			]),
			wk(now, [{ exercise_id: 'bn', sets: [set('normal', 85, 5)] }]) // PR
		];
		const res = recentPRs(workouts);
		expect(res.map((p) => p.exerciseId)).toEqual(['bn', 'sq']); // newest first
		expect(res[0].at).toBe(now);
		expect(res[1].weight).toBe(110);
		expect(res[1].reps).toBe(5);
	});

	it('respects the limit', () => {
		const workouts = [
			wk(now - 10 * DAY, [{ exercise_id: 'a', sets: [set('normal', 50, 5)] }]),
			wk(now - 9 * DAY, [{ exercise_id: 'b', sets: [set('normal', 50, 5)] }]),
			wk(now - 2 * DAY, [{ exercise_id: 'a', sets: [set('normal', 60, 5)] }]), // PR a
			wk(now - 1 * DAY, [{ exercise_id: 'b', sets: [set('normal', 60, 5)] }]) // PR b
		];
		expect(recentPRs(workouts, 1)).toHaveLength(1);
	});

	it('skips invalid sets, ignores warm-up-only exercises, and uses the best set in a session', () => {
		const workouts = [
			wk(now - 14 * DAY, [{ exercise_id: 'sq', sets: [set('normal', 100, 5)] }]), // baseline
			wk(now - 7 * DAY, [
				{ exercise_id: 'wu', sets: [set('warmup', 60, 10)] }, // warm-up only → no working set
				{
					exercise_id: 'sq',
					sets: [
						set('normal', null, 5), // null weight → skipped
						set('normal', 0, 5), // zero weight → skipped
						set('normal', 50, 0), // zero reps → skipped
						set('normal', 105, 5), // first valid working set
						set('normal', 110, 5), // beats it → session best
						set('normal', 90, 5) // doesn't beat current best
					]
				}
			])
		];
		const res = recentPRs(workouts);
		expect(res).toHaveLength(1); // only the sq improvement; warm-up-only 'wu' produced nothing
		expect(res[0].exerciseId).toBe('sq');
		expect(res[0].weight).toBe(110); // best working set in the session
	});

	it('returns nothing without prior history', () => {
		expect(recentPRs([wk(now, [{ exercise_id: 'sq', sets: [set('normal', 100, 5)] }])])).toEqual([]);
	});
});

describe('allTimeRecords', () => {
	it('keeps the best e1RM per exercise, strongest first, warm-ups excluded', () => {
		const workouts = [
			wk(now - 14 * DAY, [{ exercise_id: 'sq', sets: [set('normal', 100, 5), set('warmup', 200, 1)] }]),
			wk(now - 7 * DAY, [{ exercise_id: 'sq', sets: [set('normal', 120, 5)] }]), // new best for sq
			wk(now, [{ exercise_id: 'bn', sets: [set('normal', 80, 5)] }])
		];
		const res = allTimeRecords(workouts);
		expect(res.map((r) => r.exerciseId)).toEqual(['sq', 'bn']); // sq is stronger
		expect(res[0]).toMatchObject({ weight: 120, reps: 5, at: now - 7 * DAY });
	});

	it('skips invalid sets (null/zero weight or reps) and respects the limit', () => {
		const workouts = [
			wk(now, [
				{
					exercise_id: 'a',
					sets: [set('normal', null, 5), set('normal', 0, 5), set('normal', 50, 0), set('normal', 50, 5)]
				},
				{ exercise_id: 'b', sets: [set('normal', 60, 5)] }
			])
		];
		const res = allTimeRecords(workouts);
		expect(res.find((r) => r.exerciseId === 'a')).toMatchObject({ weight: 50, reps: 5 }); // only valid set
		expect(allTimeRecords(workouts, 1)).toHaveLength(1);
		expect(allTimeRecords(workouts, 1)[0].exerciseId).toBe('b'); // 60 beats 50
	});

	it('is empty with no valid working sets', () => {
		expect(allTimeRecords([wk(now, [{ exercise_id: 'x', sets: [set('warmup', 40, 5)] }])])).toEqual([]);
	});
});

describe('topLifts', () => {
	it('ranks most-trained lifts and builds a chronological per-session e1RM series', () => {
		const workouts = [
			wk(now - 14 * DAY, [{ exercise_id: 'sq', sets: [set('normal', 100, 5), set('warmup', 60, 5)] }]),
			wk(now - 7 * DAY, [
				{ exercise_id: 'sq', sets: [set('normal', 110, 5)] },
				{ exercise_id: 'bn', sets: [set('normal', 80, 5)] }
			]),
			wk(now, [
				{ exercise_id: 'sq', sets: [set('normal', 120, 5)] },
				{ exercise_id: 'bn', sets: [set('normal', 85, 5)] }
			])
		];
		const res = topLifts(workouts);
		expect(res.map((l) => l.exerciseId)).toEqual(['sq', 'bn']); // sq trained 3×, bn 2×
		expect(res[0].sessions).toBe(3);
		expect(res[0].e1rmSeries).toHaveLength(3);
		expect(res[0].e1rmSeries[0]).toBeLessThan(res[0].e1rmSeries[2]); // increasing, chronological
		expect(res[0].latestE1rm).toBe(res[0].e1rmSeries[2]);
	});

	it('excludes lifts trained only once (no trend) and respects the limit', () => {
		const workouts = [
			wk(now - 7 * DAY, [{ exercise_id: 'a', sets: [set('normal', 50, 5)] }]),
			wk(now, [
				{ exercise_id: 'a', sets: [set('normal', 60, 5)] },
				{ exercise_id: 'once', sets: [set('normal', 100, 5)] } // single session → excluded
			])
		];
		expect(topLifts(workouts).map((l) => l.exerciseId)).toEqual(['a']);
		expect(topLifts(workouts, 0)).toHaveLength(0); // limit respected
	});
});
