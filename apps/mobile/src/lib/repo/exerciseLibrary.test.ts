import { describe, expect, it, vi } from 'vitest';

const { listExercises, refreshExerciseLibrary } = vi.hoisted(() => ({
	listExercises: vi.fn(),
	refreshExerciseLibrary: vi.fn()
}));
vi.mock('#lib/repo/exercises.ts', () => ({ listExercises, refreshExerciseLibrary }));

import { loadPickerLibrary } from './exerciseLibrary.ts';

const row = { id: 'e1', name: 'Bench', primary_muscle: 'chest', exercise_type: 'weight' };

describe('loadPickerLibrary', () => {
	it('returns the local rows without refreshing when there are some', async () => {
		listExercises.mockReset().mockResolvedValueOnce([row]);
		refreshExerciseLibrary.mockReset();
		expect(await loadPickerLibrary()).toEqual([{ id: 'e1', name: 'Bench', primary_muscle: 'chest' }]);
		expect(refreshExerciseLibrary).not.toHaveBeenCalled();
	});

	it('refreshes and re-reads when the local store is empty (fresh account)', async () => {
		listExercises.mockReset().mockResolvedValueOnce([]).mockResolvedValueOnce([row]);
		refreshExerciseLibrary.mockReset().mockResolvedValue(undefined);
		expect(await loadPickerLibrary()).toEqual([{ id: 'e1', name: 'Bench', primary_muscle: 'chest' }]);
		expect(refreshExerciseLibrary).toHaveBeenCalledTimes(1);
	});

	it('stays offline-safe: a failed refresh leaves the empty list, no throw', async () => {
		listExercises.mockReset().mockResolvedValue([]);
		refreshExerciseLibrary.mockReset().mockRejectedValue(new Error('offline'));
		expect(await loadPickerLibrary()).toEqual([]);
	});
});
