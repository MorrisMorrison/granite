<script lang="ts">
	import { goto } from '$app/navigation';
	import { createRoutine, type RoutineInput } from '$lib/repo/routines';
	import RoutineForm from '$lib/components/RoutineForm.svelte';

	async function create(payload: RoutineInput) {
		await createRoutine(payload);
		await goto('/routines');
	}
</script>

<svelte:head><title>New routine · Granite</title></svelte:head>

<main class="container">
	<h1>New routine</h1>
	<RoutineForm submitLabel="Create routine" onsubmit={create} />
</main>
