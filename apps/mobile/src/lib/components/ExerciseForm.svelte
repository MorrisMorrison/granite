<script lang="ts">
	import Button from '#lib/components/ui/Button.svelte';
	import type { ExerciseInput } from '#lib/repo/exercises.ts';

	let {
		initialName = '',
		initialType = 'weight_reps',
		initialMuscle = '',
		initialEquipment = '',
		submitLabel = 'Save',
		onsubmit
	}: {
		initialName?: string;
		initialType?: string;
		initialMuscle?: string;
		initialEquipment?: string;
		submitLabel?: string;
		onsubmit: (input: ExerciseInput) => void | Promise<void>;
	} = $props();

	let name = $state(initialName);
	let exercise_type = $state(initialType);
	let primary_muscle = $state(initialMuscle);
	let equipment = $state(initialEquipment);
	let saving = $state(false);

	// Suggestions only (datalist) — pick a common group or type your own.
	const MUSCLES = [
		'Chest', 'Back', 'Lats', 'Shoulders', 'Biceps', 'Triceps', 'Forearms',
		'Quadriceps', 'Hamstrings', 'Glutes', 'Calves', 'Core', 'Traps', 'Full Body'
	];

	const canSave = $derived(name.trim().length > 0 && primary_muscle.trim().length > 0);

	async function submit(e: Event) {
		e.preventDefault();
		if (!canSave || saving) return;
		saving = true;
		try {
			await onsubmit({ name, exercise_type, primary_muscle, equipment });
		} finally {
			saving = false;
		}
	}
</script>

<form class="form ef" onsubmit={submit}>
	<label class="field">
		<span class="eyebrow">Name</span>
		<input
			class="control"
			bind:value={name}
			placeholder="e.g. Cable Crossover"
			data-testid="field-exercise-name"
		/>
	</label>

	<label class="field">
		<span class="eyebrow">Type</span>
		<select class="control" bind:value={exercise_type} data-testid="field-exercise-type">
			<option value="weight_reps">Weight × reps</option>
			<option value="reps_only">Reps only</option>
			<option value="duration">Duration</option>
		</select>
	</label>

	<label class="field">
		<span class="eyebrow">Primary muscle</span>
		<input
			class="control"
			bind:value={primary_muscle}
			list="muscle-list"
			placeholder="e.g. Chest"
			data-testid="field-exercise-muscle"
		/>
		<datalist id="muscle-list">
			{#each MUSCLES as m (m)}<option value={m}></option>{/each}
		</datalist>
	</label>

	<label class="field">
		<span class="eyebrow">Equipment <span class="field-opt">(optional)</span></span>
		<input
			class="control"
			bind:value={equipment}
			placeholder="e.g. Dumbbell"
			data-testid="field-exercise-equipment"
		/>
	</label>

	<div class="ef-save">
		<Button type="submit" block disabled={!canSave || saving} testid="btn-save-exercise">
			{saving ? 'Saving…' : submitLabel}
		</Button>
	</div>
</form>

<style>
	.ef {
		margin-top: 1rem;
	}
	.ef-save {
		margin-top: 0.5rem;
	}
</style>
