import { describe, expect, it, vi } from 'vitest';

import {
	createFolder,
	createRoutine,
	getRoutine,
	listExercises,
	listRoutines,
	listWorkouts,
	logWorkout,
	updateRoutine
} from './tools';
import type { GraniteClient } from '@granite/shared';

const stub = (get: unknown) => ({ GET: get }) as unknown as GraniteClient;
const stubPost = (post: unknown) => ({ POST: post }) as unknown as GraniteClient;
const stubPatch = (patch: unknown) => ({ PATCH: patch }) as unknown as GraniteClient;

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

describe('mcp write tools', () => {
	it('log_workout POSTs to /workouts and returns the created workout', async () => {
		const post = vi.fn().mockResolvedValue({ data: { id: 'w1' } });
		const c = stubPost(post);
		const body = { exercises: [{ exercise_id: 'e1', sets: [{ reps: 5, weight: 60 }] }] };
		expect(await logWorkout(c, body)).toEqual({ id: 'w1' });
		expect(post).toHaveBeenCalledWith('/api/v1/workouts', { body });
	});

	it('create_routine POSTs to /routines and returns the created routine', async () => {
		const post = vi.fn().mockResolvedValue({ data: { id: 'r1' } });
		const c = stubPost(post);
		const body = { title: 'Push Day', exercises: [{ exercise_id: 'e1' }] };
		expect(await createRoutine(c, body)).toEqual({ id: 'r1' });
		expect(post).toHaveBeenCalledWith('/api/v1/routines', { body });
	});

	it('update_routine PATCHes /routines/{id} with the path param + body', async () => {
		const patch = vi.fn().mockResolvedValue({ data: { id: 'r1' } });
		const c = stubPatch(patch);
		const body = { title: 'Pull Day', exercises: [{ exercise_id: 'e2' }] };
		expect(await updateRoutine(c, 'r1', body)).toEqual({ id: 'r1' });
		expect(patch).toHaveBeenCalledWith('/api/v1/routines/{id}', { params: { path: { id: 'r1' } }, body });
	});

	it('create_folder POSTs to /routine-folders', async () => {
		const post = vi.fn().mockResolvedValue({ data: { id: 'f1' } });
		const c = stubPost(post);
		const body = { name: 'Strength' };
		expect(await createFolder(c, body)).toEqual({ id: 'f1' });
		expect(post).toHaveBeenCalledWith('/api/v1/routine-folders', { body });
	});

	it('propagates API errors (e.g. 403 from a read-only token)', async () => {
		const post = vi.fn().mockResolvedValue({ error: { code: 'forbidden', error: 'write scope required' } });
		const c = stubPost(post);
		await expect(logWorkout(c, { exercises: [] })).rejects.toThrow(/Granite API error/);
	});
});
