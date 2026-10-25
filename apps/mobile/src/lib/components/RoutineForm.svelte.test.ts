import { render } from '@testing-library/svelte';
import { fireEvent } from '@testing-library/dom';
import { describe, expect, it, vi } from 'vitest';

const { listExercises, listFolders, createExercise, refreshExerciseLibrary } = vi.hoisted(() => ({
	refreshExerciseLibrary: vi.fn(() => Promise.resolve()),
	listExercises: vi.fn(() =>
		Promise.resolve([
			{ id: 'e1', name: 'Bench', primary_muscle: 'chest', exercise_type: 'weight', is_builtin: true }
		])
	),
	listFolders: vi.fn(() => Promise.resolve([{ id: 'f1', name: 'Strength', order_index: 0 }])),
	createExercise: vi.fn(() => Promise.resolve('new-ex-id'))
}));
vi.mock('#lib/repo/exercises.ts', () => ({ listExercises, createExercise, refreshExerciseLibrary }));
vi.mock('#lib/repo/folders.ts', () => ({ listFolders }));
vi.mock('#lib/stores/prefs.svelte.ts', () => ({ prefs: { current: { weightUnit: 'kg', restSeconds: 90 } } }));

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

describe('RoutineForm exercise card', () => {
	const initial = () => [
		{
			exercise_id: 'e1',
			rest_seconds: 90,
			sets: [
				{ set_type: 'normal', target_weight: 100, target_reps: 5 },
				{ set_type: 'normal', target_weight: 100, target_reps: 5 }
			]
		}
	];
	type P = { exercises: { sets: { set_type: string }[] }[] };
	const lastPayload = (fn: ReturnType<typeof vi.fn>) => fn.mock.calls[0][0] as P;

	it('badges sets and changes the type from the badge sheet', async () => {
		const onsubmit = vi.fn((_p: unknown) => Promise.resolve());
		const { getAllByTestId, getByTestId } = render(RoutineForm, {
			props: { initialTitle: 'T', initialExercises: initial(), onsubmit }
		});
		const badges = getAllByTestId('rf-set-label');
		expect(badges.map((b) => b.textContent)).toEqual(['1', '2']);
		await fireEvent.click(badges[0]);
		await fireEvent.click(getByTestId('set-type-warmup'));
		expect(getAllByTestId('rf-set-label').map((b) => b.textContent)).toEqual(['W', '1']);
		expect(getAllByTestId('rf-set')[0].classList.contains('warmup')).toBe(true);
		await fireEvent.click(getByTestId('btn-save-routine'));
		expect(lastPayload(onsubmit).exercises[0].sets.map((x) => x.set_type)).toEqual(['warmup', 'normal']);
	});

	it('deletes a set from the badge sheet', async () => {
		const { getAllByTestId, getByTestId } = render(RoutineForm, {
			props: { initialTitle: 'T', initialExercises: initial(), onsubmit: vi.fn() }
		});
		await fireEvent.click(getAllByTestId('rf-set-label')[1]);
		await fireEvent.click(getByTestId('btn-delete-set'));
		expect(getAllByTestId('rf-set')).toHaveLength(1);
	});

	it('adds a set from the ghost row, copying the last targets', async () => {
		const { getAllByTestId, getByTestId } = render(RoutineForm, {
			props: { initialTitle: 'T', initialExercises: initial(), onsubmit: vi.fn() }
		});
		await fireEvent.click(getByTestId('btn-add-set'));
		const w = getAllByTestId('field-target-weight') as HTMLInputElement[];
		expect(w).toHaveLength(3);
		expect(w[2].value).toBe('100');
	});

	it('adds warm-ups and removes the exercise from the actions menu', async () => {
		const { getAllByTestId, getByTestId, queryByTestId } = render(RoutineForm, {
			props: { initialTitle: 'T', initialExercises: initial(), onsubmit: vi.fn() }
		});
		await fireEvent.click(getByTestId('btn-ex-menu'));
		await fireEvent.click(getByTestId('btn-warmups'));
		expect(getAllByTestId('rf-set-label')[0].textContent).toBe('W');
		expect(queryByTestId('btn-warmups')).toBeNull(); // menu closed

		await fireEvent.click(getByTestId('btn-ex-menu'));
		await fireEvent.click(getByTestId('btn-remove-exercise'));
		expect(queryByTestId('rf-exercise')).toBeNull();
	});

	it('disables Add warm-ups until a work set has a weight', async () => {
		const { getByTestId } = render(RoutineForm, {
			props: {
				initialTitle: 'T',
				initialExercises: [
					{ exercise_id: 'e1', rest_seconds: 90, sets: [{ set_type: 'normal', target_weight: null, target_reps: 5 }] }
				],
				onsubmit: vi.fn()
			}
		});
		await fireEvent.click(getByTestId('btn-ex-menu'));
		expect((getByTestId('btn-warmups') as HTMLButtonElement).disabled).toBe(true);
	});
});

describe('RoutineForm on a fresh account', () => {
	it('refreshes the library when the local list is empty, then shows the rows', async () => {
		listExercises.mockReset();
		listExercises
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([
				{ id: 'e9', name: 'Squat', primary_muscle: 'legs', exercise_type: 'weight', is_builtin: true }
			]);
		refreshExerciseLibrary.mockClear();
		const { getByTestId, findByTestId } = render(RoutineForm, {
			props: { initialTitle: 'New', onsubmit: vi.fn() }
		});
		await fireEvent.click(getByTestId('btn-add-exercise'));
		expect(await findByTestId('picker-exercise')).toBeTruthy();
		expect(refreshExerciseLibrary).toHaveBeenCalledTimes(1);
	});
});
