import { render } from '@testing-library/svelte';
import { fireEvent } from '@testing-library/dom';
import { describe, expect, it, vi } from 'vitest';

const { listExercises, listFolders, createExercise } = vi.hoisted(() => ({
	listExercises: vi.fn(() =>
		Promise.resolve([
			{ id: 'e1', name: 'Bench', primary_muscle: 'chest', exercise_type: 'weight', is_builtin: true }
		])
	),
	listFolders: vi.fn(() => Promise.resolve([{ id: 'f1', name: 'Strength', order_index: 0 }])),
	createExercise: vi.fn(() => Promise.resolve('new-ex-id'))
}));
vi.mock('$lib/repo/exercises', () => ({ listExercises, createExercise }));
vi.mock('$lib/repo/folders', () => ({ listFolders }));
vi.mock('$lib/stores/prefs.svelte', () => ({ prefs: { current: { weightUnit: 'kg', restSeconds: 90 } } }));

import RoutineForm from './RoutineForm.svelte';

describe('RoutineForm', () => {
	it('requires a title and does not submit when empty', async () => {
		const onsubmit = vi.fn(() => Promise.resolve());
		const { getByTestId, findByText } = render(RoutineForm, { props: { onsubmit } });

		await fireEvent.click(getByTestId('btn-save-routine'));

		expect(onsubmit).not.toHaveBeenCalled();
		expect(await findByText('A title is required.')).toBeTruthy();
	});

	it('submits a trimmed, mapped payload from the initial exercises', async () => {
		const onsubmit = vi.fn((_payload: unknown) => Promise.resolve());
		const { getByTestId } = render(RoutineForm, {
			props: {
				initialTitle: '  Push  ',
				initialFolderId: null,
				initialExercises: [
					{ exercise_id: 'e1', rest_seconds: 90, sets: [{ set_type: 'normal', target_weight: 100, target_reps: 5 }] }
				],
				onsubmit
			}
		});

		await fireEvent.click(getByTestId('btn-save-routine'));

		expect(onsubmit).toHaveBeenCalledTimes(1);
		const payload = onsubmit.mock.calls[0][0] as {
			title: string;
			folder_id: string | null;
			exercises: { exercise_id: string; rest_seconds: number; sets: { set_type: string; target_weight?: number; target_reps?: number }[] }[];
		};
		expect(payload).toMatchObject({ title: 'Push', folder_id: null });
		expect(payload.exercises[0]).toMatchObject({ exercise_id: 'e1', rest_seconds: 90 });
		// kg unit → weight passes through unchanged.
		expect(payload.exercises[0].sets[0]).toMatchObject({ set_type: 'normal', target_weight: 100, target_reps: 5 });
	});

	it('shows the folder selector once folders have loaded', async () => {
		const { findByTestId } = render(RoutineForm, { props: { onsubmit: vi.fn() } });
		expect(await findByTestId('field-routine-folder')).toBeTruthy();
	});

	it('adds an exercise from the picker and includes it on submit', async () => {
		const onsubmit = vi.fn((_payload: unknown) => Promise.resolve());
		const { getByTestId, findByTestId } = render(RoutineForm, {
			props: { initialTitle: 'New', onsubmit }
		});

		await fireEvent.click(getByTestId('btn-add-exercise'));
		await fireEvent.click(await findByTestId('picker-exercise'));
		await fireEvent.click(getByTestId('btn-save-routine'));

		const payload = onsubmit.mock.calls[0][0] as { exercises: { exercise_id: string }[] };
		expect(payload.exercises.map((e) => e.exercise_id)).toEqual(['e1']);
	});

	it('creates a custom exercise from the picker and adds it to the routine', async () => {
		const onsubmit = vi.fn((_payload: unknown) => Promise.resolve());
		const { getByTestId, findByTestId } = render(RoutineForm, {
			props: { initialTitle: 'New', onsubmit }
		});

		await fireEvent.click(getByTestId('btn-add-exercise'));
		await fireEvent.click(await findByTestId('btn-picker-new-exercise'));
		await fireEvent.input(getByTestId('field-exercise-name'), { target: { value: 'Cable Crossover' } });
		await fireEvent.input(getByTestId('field-exercise-muscle'), { target: { value: 'Chest' } });
		await fireEvent.click(getByTestId('btn-save-exercise'));
		await fireEvent.click(getByTestId('btn-save-routine'));

		expect(createExercise).toHaveBeenCalledWith(
			expect.objectContaining({ name: 'Cable Crossover', primary_muscle: 'Chest' })
		);
		const payload = onsubmit.mock.calls[0][0] as { exercises: { exercise_id: string }[] };
		expect(payload.exercises.map((e) => e.exercise_id)).toEqual(['new-ex-id']);
	});
});
