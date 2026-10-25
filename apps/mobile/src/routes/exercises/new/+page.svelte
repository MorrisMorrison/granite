<script lang="ts">
	import { goto } from '$app/navigation';
	import { createExercise, type ExerciseInput } from '#lib/repo/exercises.ts';
	import ExerciseForm from '#lib/components/ExerciseForm.svelte';
	import BackLink from '#lib/components/ui/BackLink.svelte';

	async function create(input: ExerciseInput) {
		await createExercise(input);
		await goto('/exercises');
	}
</script>

<svelte:head><title>New exercise · Granite</title></svelte:head>

<main class="container">
	<BackLink href="/exercises" label="Exercises" />
	<h1 class="page-title">New exercise</h1>
	<ExerciseForm submitLabel="Create exercise" onsubmit={create} />
</main>
