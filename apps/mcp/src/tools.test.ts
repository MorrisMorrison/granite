import { describe, expect, it, vi } from 'vitest';

import { getRoutine, listExercises, listRoutines, listWorkouts } from './tools';
import type { GraniteClient } from '@granite/shared';

const stub = (get: unknown) => ({ GET: get }) as unknown as GraniteClient;

describe('mcp read tools', () => {
	it('list_exercises filters by case-insensitive name substring', async () => {
		const c = stub(vi.fn().mockResolvedValue({ data: { exercises: [{ name: 'Back Squat' }, { name: 'Bench Press' }] } }));
		expect(await listExercises(c, 'squat')).toEqual([{ name: 'Back Squat' }]);
	});

	it('list_exercises returns all when no query is given', async () => {
		const c = stub(vi.fn().mockResolvedValue({ data: { exercises: [{ name: 'A' }, { name: 'B' }] } }));
		expect(await listExercises(c)).toHaveLength(2);
	});

	it('list_routines / list_workouts unwrap the list envelope', async () => {
		const r = stub(vi.fn().mockResolvedValue({ data: { routines: [{ id: 'r1' }] } }));
		expect(await listRoutines(r)).toEqual([{ id: 'r1' }]);
		const w = stub(vi.fn().mockResolvedValue({ data: { workouts: [{ id: 'w1' }] } }));
		expect(await listWorkouts(w)).toEqual([{ id: 'w1' }]);
	});

	it('throws a useful error when the API returns an error', async () => {
		const c = stub(vi.fn().mockResolvedValue({ error: { error: 'not found', code: 'not_found' } }));
		await expect(getRoutine(c, 'missing')).rejects.toThrow(/Granite API error/);
	});
});
