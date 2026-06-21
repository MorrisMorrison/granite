import { describe, expect, it } from 'vitest';
import { computeExerciseProgress } from './stats';

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
