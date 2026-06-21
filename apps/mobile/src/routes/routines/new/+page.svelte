<script lang="ts">
	import { goto } from '$app/navigation';
	import { createRoutine, type RoutineInput } from '$lib/repo/routines';
	import RoutineForm from '$lib/components/RoutineForm.svelte';
	import BackLink from '$lib/components/ui/BackLink.svelte';

	async function create(payload: RoutineInput) {
		await createRoutine(payload);
		await goto('/routines');
	}
</script>

<svelte:head><title>New routine · Granite</title></svelte:head>

<main class="container">
	<BackLink href="/routines" label="Routines" />
	<h1>New routine</h1>
	<RoutineForm submitLabel="Create routine" onsubmit={create} />
</main>
