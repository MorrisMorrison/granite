import { describe, expect, it } from 'vitest';
import { buildHevyImport, parseCsv, type LibraryExercise } from './hevy';

const LIBRARY: LibraryExercise[] = [
	{ id: 'bb-bench', name: 'Barbell Bench Press' },
	{ id: 'pullup', name: 'Pull Up' },
	{ id: 'face-pull', name: 'Face Pull' }
];

const SAMPLE = `title,start_time,end_time,description,exercise_title,superset_id,exercise_notes,set_index,set_type,weight_kg,reps,distance_km,duration_seconds,rpe
"Push A","Jun 23, 2026, 12:27 PM","Jun 23, 2026, 1:50 PM","","Bench Press (Barbell)","","cue, hard",0,warmup,40,5,,,
"Push A","Jun 23, 2026, 12:27 PM","Jun 23, 2026, 1:50 PM","","Bench Press (Barbell)","",,1,normal,100,5,,,8
"Push A","Jun 23, 2026, 12:27 PM","Jun 23, 2026, 1:50 PM","","Overhead Squat","",,0,normal,60,3,,,
"Pull B","Jun 24, 2026, 10:00 AM","","","Pull Up (Weighted)","",,0,normal,20,8,,,
"Pull B","Jun 24, 2026, 10:00 AM","","","Face Pull","",,0,failure,,15,,,`;

describe('parseCsv', () => {
	it('handles quoted commas and "" escapes', () => {
		expect(parseCsv('a,"b,c","d""e"')).toEqual([['a', 'b,c', 'd"e']]);
	});

	it('splits rows on CRLF and LF', () => {
		expect(parseCsv('a,b\r\nc,d\ne,f')).toEqual([
			['a', 'b'],
			['c', 'd'],
			['e', 'f']
		]);
	});
});

describe('buildHevyImport', () => {
	it('groups rows into workouts and exercises', () => {
		const r = buildHevyImport(SAMPLE, LIBRARY, 1000);
		expect(r.workoutCount).toBe(2);
		expect(r.setCount).toBe(5);

		const push = r.envelope.workouts.find((w) => w.title === 'Push A')!;
		expect(push.exercises).toHaveLength(2); // bench + overhead squat
		expect(push.exercises[0].sets).toHaveLength(2);
		expect(push.start_time).toBeGreaterThan(0);
	});

	it('maps known exercises via alias / exact name and reuses library ids', () => {
		const r = buildHevyImport(SAMPLE, LIBRARY, 1000);
		const push = r.envelope.workouts.find((w) => w.title === 'Push A')!;
		expect(push.exercises[0].exercise_id).toBe('bb-bench'); // Bench Press (Barbell) → Barbell Bench Press
		const pull = r.envelope.workouts.find((w) => w.title === 'Pull B')!;
		expect(pull.exercises[0].exercise_id).toBe('pullup'); // Pull Up (Weighted) → Pull Up
		expect(r.matchedExercises).toContain('Bench Press (Barbell)');
		expect(r.matchedExercises).toContain('Face Pull'); // exact match
	});

	it('creates a custom exercise for unmatched titles', () => {
		const r = buildHevyImport(SAMPLE, LIBRARY, 1000);
		expect(r.customExercises).toEqual(['Overhead Squat']);
		expect(r.envelope.exercises).toHaveLength(1);
		const custom = r.envelope.exercises[0];
		expect(custom.name).toBe('Overhead Squat');
		expect(custom.is_builtin).toBe(false);
		// the workout references the custom's id
		const push = r.envelope.workouts.find((w) => w.title === 'Push A')!;
		expect(push.exercises[1].exercise_id).toBe(custom.id);
	});

	it('parses set fields and preserves set types', () => {
		const r = buildHevyImport(SAMPLE, LIBRARY, 1000);
		const bench = r.envelope.workouts.find((w) => w.title === 'Push A')!.exercises[0];
		expect(bench.sets[0]).toMatchObject({ set_type: 'warmup', weight: 40, reps: 5, is_completed: true });
		expect(bench.sets[1]).toMatchObject({ set_type: 'normal', weight: 100, reps: 5, rpe: 8 });
		// a reps-only failure set with no weight
		const facePull = r.envelope.workouts.find((w) => w.title === 'Pull B')!.exercises[1];
		expect(facePull.sets[0]).toMatchObject({ set_type: 'failure', weight: null, reps: 15 });
	});

	it('keeps notes from the exercise_notes column', () => {
		const r = buildHevyImport(SAMPLE, LIBRARY, 1000);
		const bench = r.envelope.workouts.find((w) => w.title === 'Push A')!.exercises[0];
		expect(bench.notes).toBe('cue, hard');
	});

	it('is idempotent — same input yields the same ids', () => {
		const a = buildHevyImport(SAMPLE, LIBRARY, 1000);
		const b = buildHevyImport(SAMPLE, LIBRARY, 9999);
		expect(a.envelope.workouts.map((w) => w.id)).toEqual(b.envelope.workouts.map((w) => w.id));
		expect(a.envelope.exercises.map((e) => e.id)).toEqual(b.envelope.exercises.map((e) => e.id));
	});

	it('returns empty for a header-only or empty file', () => {
		expect(buildHevyImport('', LIBRARY).workoutCount).toBe(0);
		expect(buildHevyImport('title,start_time\n', LIBRARY).workoutCount).toBe(0);
	});
});
