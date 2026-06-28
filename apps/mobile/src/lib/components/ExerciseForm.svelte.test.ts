import { render } from '@testing-library/svelte';
import { fireEvent } from '@testing-library/dom';
import { describe, expect, it, vi } from 'vitest';
import ExerciseForm from './ExerciseForm.svelte';

describe('ExerciseForm', () => {
	it('submits the entered fields', async () => {
		const onsubmit = vi.fn();
		const { getByTestId } = render(ExerciseForm, { props: { onsubmit } });
		await fireEvent.input(getByTestId('field-exercise-name'), { target: { value: 'Cable Fly' } });
		await fireEvent.input(getByTestId('field-exercise-muscle'), { target: { value: 'Chest' } });
		await fireEvent.change(getByTestId('field-exercise-type'), { target: { value: 'reps_only' } });
		await fireEvent.click(getByTestId('btn-save-exercise'));
		expect(onsubmit).toHaveBeenCalledWith({
			name: 'Cable Fly',
			exercise_type: 'reps_only',
			primary_muscle: 'Chest',
			equipment: ''
		});
	});

	it('disables submit until name + muscle are filled', async () => {
		const { getByTestId } = render(ExerciseForm, { props: { onsubmit: vi.fn() } });
		expect((getByTestId('btn-save-exercise') as HTMLButtonElement).disabled).toBe(true);
		await fireEvent.input(getByTestId('field-exercise-name'), { target: { value: 'Fly' } });
		await fireEvent.input(getByTestId('field-exercise-muscle'), { target: { value: 'Chest' } });
		expect((getByTestId('btn-save-exercise') as HTMLButtonElement).disabled).toBe(false);
	});

	it('prefills initial values for editing', () => {
		const { getByTestId } = render(ExerciseForm, {
			props: {
				onsubmit: vi.fn(),
				initialName: 'Squat',
				initialMuscle: 'Quadriceps',
				initialEquipment: 'Barbell'
			}
		});
		expect((getByTestId('field-exercise-name') as HTMLInputElement).value).toBe('Squat');
		expect((getByTestId('field-exercise-muscle') as HTMLInputElement).value).toBe('Quadriceps');
		expect((getByTestId('field-exercise-equipment') as HTMLInputElement).value).toBe('Barbell');
	});
});
