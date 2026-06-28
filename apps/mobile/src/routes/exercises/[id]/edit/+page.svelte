<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import {
		getExercise,
		updateExercise,
		type ExerciseInput,
		type ExerciseRow
	} from '$lib/repo/exercises';
	import ExerciseForm from '$lib/components/ExerciseForm.svelte';
	import BackLink from '$lib/components/ui/BackLink.svelte';

	const id = page.params.id!;
	let ex = $state<ExerciseRow | null>(null);
	let loading = $state(true);

	onMount(async () => {
		ex = await getExercise(id);
		// Built-ins are read-only — bounce back to the detail.
		if (ex?.is_builtin) {
			await goto(`/exercises/${id}`);
			return;
		}
		loading = false;
	});

	async function save(input: ExerciseInput) {
		await updateExercise(id, input);
		await goto(`/exercises/${id}`);
	}
</script>

<svelte:head><title>Edit exercise · Granite</title></svelte:head>

<main class="container">
	<BackLink href={`/exercises/${id}`} label="Back" />
	{#if loading}
		<p class="muted">Loading…</p>
	{:else if ex}
		<h1>Edit exercise</h1>
		<ExerciseForm
			submitLabel="Save changes"
			initialName={ex.name}
			initialType={ex.exercise_type}
			initialMuscle={ex.primary_muscle}
			initialEquipment={ex.equipment}
			onsubmit={save}
		/>
	{/if}
</main>

<style>
	h1 {
		font-size: 1.4rem;
		margin: 0.25rem 0 0;
	}
</style>
