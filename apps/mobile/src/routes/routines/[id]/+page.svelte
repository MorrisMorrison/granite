<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { getRoutine, updateRoutine, type RoutineDetail, type RoutineInput } from '$lib/repo/routines';
	import RoutineForm from '$lib/components/RoutineForm.svelte';

	const id = page.params.id!;

	let loaded = $state<RoutineDetail | null>(null);
	let loading = $state(true);
	let loadError = $state('');

	onMount(async () => {
		loaded = await getRoutine(id);
		if (!loaded) loadError = 'Routine not found.';
		loading = false;
	});

	async function update(payload: RoutineInput) {
		await updateRoutine(id, payload);
		await goto('/routines');
	}
</script>

<svelte:head><title>Edit routine · Granite</title></svelte:head>

<main class="container">
	{#if loading}
		<p class="muted">Loading…</p>
	{:else if loadError}
		<p class="error">{loadError}</p>
	{:else if loaded}
		<h1>Edit routine</h1>
		<RoutineForm
			initialTitle={loaded.title}
			initialNotes={loaded.notes}
			initialExercises={loaded.exercises}
			submitLabel="Save changes"
			onsubmit={update}
		/>
	{/if}
</main>
