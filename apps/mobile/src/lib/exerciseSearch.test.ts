import { describe, expect, it } from 'vitest';
import { filterExercises } from './exerciseSearch';

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
