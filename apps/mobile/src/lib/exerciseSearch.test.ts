import { describe, expect, it } from 'vitest';
import { filterExercises, groupByMuscle, metaLine } from './exerciseSearch';

const lib = [
	{ id: '1', name: 'Barbell Bench Press', primary_muscle: 'Chest' },
	{ id: '2', name: 'Barbell Back Squat', primary_muscle: 'Quadriceps' },
	{ id: '3', name: 'Pull Up', primary_muscle: 'Lats' }
];

describe('filterExercises', () => {
	it('returns everything for an empty or blank query', () => {
		expect(filterExercises(lib, '')).toEqual(lib);
		expect(filterExercises(lib, '   ')).toEqual(lib);
	});

	it('matches the name case-insensitively', () => {
		expect(filterExercises(lib, 'BARBELL').map((e) => e.id)).toEqual(['1', '2']);
		expect(filterExercises(lib, ' squat ').map((e) => e.id)).toEqual(['2']);
	});

	it('matches the primary muscle', () => {
		expect(filterExercises(lib, 'lats').map((e) => e.id)).toEqual(['3']);
	});

	it('returns an empty list when nothing matches', () => {
		expect(filterExercises(lib, 'curl')).toEqual([]);
	});
});

describe('groupByMuscle', () => {
	it('groups by muscle, sorted, keeping item order', () => {
		const g = groupByMuscle([
			{ id: 'a', primary_muscle: 'Chest' },
			{ id: 'b', primary_muscle: 'Back' },
			{ id: 'c', primary_muscle: 'Chest' }
		]);
		expect(g.map((x) => x.muscle)).toEqual(['Back', 'Chest']);
		expect(g[1].items.map((x) => x.id)).toEqual(['a', 'c']);
	});

	it('merges case variants under the first-seen spelling', () => {
		const g = groupByMuscle([
			{ id: 'a', primary_muscle: 'chest' },
			{ id: 'b', primary_muscle: 'Chest ' }
		]);
		expect(g).toHaveLength(1);
		expect(g[0].muscle).toBe('chest');
		expect(g[0].items).toHaveLength(2);
	});

	it('puts exercises without a muscle in a trailing Other group', () => {
		const g = groupByMuscle([
			{ id: 'a', primary_muscle: '' },
			{ id: 'b', primary_muscle: 'Triceps' }
		]);
		expect(g.map((x) => x.muscle)).toEqual(['Triceps', 'Other']);
	});

	it('returns no groups for an empty list', () => {
		expect(groupByMuscle([])).toEqual([]);
	});
});

describe('metaLine', () => {
	it('joins non-empty parts with a middle dot', () => {
		expect(metaLine('Chest', 'Barbell')).toBe('Chest · Barbell');
		expect(metaLine('Chest', '', null, undefined, ' ')).toBe('Chest');
		expect(metaLine()).toBe('');
	});
});
