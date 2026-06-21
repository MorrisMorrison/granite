<script lang="ts">
	import { goto } from '$app/navigation';
	import { api } from '$lib/api/client';
	import RoutineForm from '$lib/components/RoutineForm.svelte';

	type RoutinePayload = {
		title: string;
		notes: string;
		exercises: {
			exercise_id: string;
			rest_seconds: number;
			sets: { set_type: string; target_weight?: number; target_reps?: number }[];
		}[];
	};

	async function create(payload: RoutinePayload) {
		const { data, error } = await api().POST('/api/v1/routines', { body: payload });
		if (error || !data) throw new Error('Failed to save routine');
		await goto('/routines');
	}
</script>

<svelte:head><title>New routine · Granite</title></svelte:head>

<main class="container">
	<h1>New routine</h1>
	<RoutineForm submitLabel="Create routine" onsubmit={create} />
</main>
