import { describe, expect, it } from 'vitest';
import {
	computeExerciseProgress,
	computeHomeStats,
	computeLastPerformance,
	lastDoneAt,
	nextRoutine,
	relativeDay,
	weekDays
} from './stats';

const rec = (
	id: string,
	start: number,
	sets: { weight: number | null; reps: number | null; is_completed?: boolean }[]
) => ({ id, data: { start_time: start, exercises: [{ exercise_id: 'squat', sets }] } });

describe('computeExerciseProgress', () => {
	it('returns empty progress when the exercise was never trained', () => {
		const p = computeExerciseProgress([rec('w1', 1, [{ weight: 60, reps: 5 }])], 'bench');
		expect(p.total_sessions).toBe(0);
		expect(p.pr_weight).toBeNull();
	});

	it('aggregates per session, chronologically, with PRs', () => {
		const p = computeExerciseProgress(
			[
				rec('w2', 2000, [
					{ weight: 80, reps: 5 },
					{ weight: 90, reps: 3 }
				]),
				rec('w1', 1000, [{ weight: 70, reps: 5 }])
			],
			'squat'
		);
		expect(p.total_sessions).toBe(2);
		expect(p.sessions.map((s) => s.workout_id)).toEqual(['w1', 'w2']); // oldest first
		expect(p.sessions[1].top_weight).toBe(90);
		expect(p.sessions[1].top_reps).toBe(3);
		expect(p.sessions[1].volume).toBe(670); // 80*5 + 90*3
		expect(p.pr_weight).toBe(90);
		expect(p.pr_weight_reps).toBe(3);
		expect(p.pr_volume).toBe(670);
		expect(p.pr_1rm).toBeCloseTo(99, 1); // 90*(1+3/30)
	});

	it('ignores explicitly uncompleted sets', () => {
		const p = computeExerciseProgress(
			[
				rec('w1', 1, [
					{ weight: 100, reps: 1, is_completed: false },
					{ weight: 60, reps: 5, is_completed: true }
				])
			],
			'squat'
		);
		expect(p.pr_weight).toBe(60);
	});
});

describe('computeLastPerformance', () => {
	it('returns the most recent prior session of completed sets', () => {
		const last = computeLastPerformance(
			[
				rec('old', 1000, [{ weight: 60, reps: 5 }]),
				rec('new', 3000, [
					{ weight: 70, reps: 5 },
					{ weight: 70, reps: 4 }
				])
			],
			'squat'
		);
		expect(last?.date).toBe(3000);
		expect(last?.sets).toEqual([
			{ weight: 70, reps: 5 },
			{ weight: 70, reps: 4 }
		]);
	});

	it('skips uncompleted sets and returns null when never trained', () => {
		expect(computeLastPerformance([rec('w', 1, [{ weight: 50, reps: 5 }])], 'bench')).toBeNull();
		const last = computeLastPerformance(
			[rec('w', 1, [{ weight: 99, reps: 1, is_completed: false }, { weight: 50, reps: 5, is_completed: true }])],
			'squat'
		);
		expect(last?.sets).toEqual([{ weight: 50, reps: 5 }]);
	});
});

describe('computeHomeStats', () => {
	const DAY = 86400000;
	// A fixed "now": Wed 2026-06-24 12:00 local.
	const now = new Date(2026, 5, 24, 12, 0, 0).getTime();
	const w = (t: number) => ({ start_time: t });

	it('counts total, this week, and the last workout', () => {
		const s = computeHomeStats(
			[w(now), w(now - DAY), w(now - 21 * DAY)],
			now
		);
		expect(s.total).toBe(3);
		expect(s.thisWeek).toBe(2); // today + yesterday are in the same Mon-start week
		expect(s.lastWorkoutAt).toBe(now);
	});

	it('counts consecutive week streaks', () => {
		// One workout in each of the last 3 weeks (incl. this week).
		const s = computeHomeStats([w(now), w(now - 7 * DAY), w(now - 14 * DAY)], now);
		expect(s.streakWeeks).toBe(3);
	});

	it('does not break the streak for an untrained current week', () => {
		// Nothing this week, but the previous two weeks were trained.
		const s = computeHomeStats([w(now - 8 * DAY), w(now - 15 * DAY)], now);
		expect(s.thisWeek).toBe(0);
		expect(s.streakWeeks).toBe(2);
	});

	it('breaks the streak when a week is missed', () => {
		// This week + a week three weeks ago (gap in between).
		const s = computeHomeStats([w(now), w(now - 21 * DAY)], now);
		expect(s.streakWeeks).toBe(1);
	});

	it('handles an empty history', () => {
		const s = computeHomeStats([], now);
		expect(s).toEqual({ total: 0, thisWeek: 0, streakWeeks: 0, lastWorkoutAt: null });
	});
});

describe('nextRoutine', () => {
	const r = (id: string, folder: string | null = null) => ({ id, title: id.toUpperCase(), folder_id: folder });
	const w = (routine_id: string | null, start_time: number, title = '') => ({ routine_id, title, start_time });
	const push = r('push'), pull = r('pull'), legs = r('legs');

	it('is null with no routines', () => {
		expect(nextRoutine([], [w('x', 1)])).toBeNull();
	});
	it('is the first routine without workouts', () => {
		expect(nextRoutine([push, pull, legs], [])).toBe(push);
	});
	it('rotates PPL', () => {
		const all = [push, pull, legs];
		expect(nextRoutine(all, [w('push', 1), w('pull', 2), w('legs', 3)])).toBe(push);
		expect(nextRoutine(all, [w('legs', 1), w('push', 2)] )).toBe(pull);
	});
	it('prefers a never-done routine in the folder', () => {
		expect(nextRoutine([push, pull, legs], [w('push', 5)])).toBe(pull);
	});
	it('matches by routine_id before a title that matches another routine', () => {
		const out = nextRoutine([push, pull], [w('push', 1, 'PULL'), w('pull', 0, '')]);
		// last workout is push (by id) -> pull was done at 0, push at 1 -> pull
		expect(out).toBe(pull);
	});
	it('falls back to title match when there is no routine_id', () => {
		expect(nextRoutine([push, pull], [w(null, 1, 'PUSH')])).toBe(pull);
	});
	it('is the first routine when the last workout is not from a routine', () => {
		expect(nextRoutine([push, pull], [w('pull', 1), w(null, 2, 'Freestyle')])).toBe(push);
	});
	it('does not mix folders', () => {
		const a1 = r('a1', 'A'), a2 = r('a2', 'A'), b1 = r('b1', 'B');
		expect(nextRoutine([b1, a1, a2], [w('a1', 1)])).toBe(a2);
		expect(nextRoutine([a1, b1, a2], [w('a1', 2), w('a2', 1)])).toBe(a2);
	});
	it('handles unsorted workouts', () => {
		expect(nextRoutine([push, pull, legs], [w('legs', 3), w('push', 1), w('pull', 2)])).toBe(push);
	});
});

describe('lastDoneAt', () => {
	const rt = { id: 'push', title: 'Push' };
	it('is the latest matching start_time', () => {
		expect(lastDoneAt(rt, [{ routine_id: 'push', title: '', start_time: 5 }, { routine_id: null, title: 'Push', start_time: 9 }, { routine_id: 'x', title: 'Push', start_time: 99 }])).toBe(9);
	});
	it('is null when never done', () => {
		expect(lastDoneAt(rt, [])).toBeNull();
	});
});

describe('weekDays', () => {
	// Wed 2026-10-21 12:00 local; week Mon 19 .. Sun 25
	const now = new Date(2026, 9, 21, 12).getTime();
	it('starts on Monday and flags trained, today and future', () => {
		const days = weekDays(
			[{ start_time: new Date(2026, 9, 19, 8).getTime() }, { start_time: new Date(2026, 9, 21, 7).getTime() }, { start_time: new Date(2026, 9, 12, 7).getTime() }],
			now
		);
		expect(days.map((d) => d.label)).toEqual(['M', 'T', 'W', 'T', 'F', 'S', 'S']);
		expect(days.map((d) => d.trained)).toEqual([true, false, true, false, false, false, false]);
		expect(days.map((d) => d.today)).toEqual([false, false, true, false, false, false, false]);
		expect(days.map((d) => d.future)).toEqual([false, false, false, true, true, true, true]);
	});
});

describe('relativeDay', () => {
	const now = new Date(2026, 9, 25, 0, 30).getTime();
	it('uses calendar days, not elapsed hours', () => {
		expect(relativeDay(new Date(2026, 9, 24, 23, 0).getTime(), now)).toBe('Yesterday');
	});
	it('same day is Today', () => {
		expect(relativeDay(new Date(2026, 9, 25, 0, 5).getTime(), now)).toBe('Today');
	});
	it('2-6 calendar days ago', () => {
		expect(relativeDay(new Date(2026, 9, 22, 23, 59).getTime(), now)).toBe('3 days ago');
	});
	it('7+ days is a short date', () => {
		const s = relativeDay(new Date(2026, 9, 17, 12).getTime(), now);
		expect(s).not.toMatch(/days ago|Today|Yesterday/);
	});
});
