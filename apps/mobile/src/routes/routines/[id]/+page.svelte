<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { api } from '$lib/api/client';
	import RoutineForm from '$lib/components/RoutineForm.svelte';

	const id = page.params.id!;

	let loaded = $state<{
		title: string;
		notes: string;
		exercises: {
			exercise_id: string;
			rest_seconds: number;
			sets: { set_type: string; target_weight: number | null; target_reps: number | null }[];
		}[];
	} | null>(null);
	let loading = $state(true);
	let loadError = $state('');

	onMount(async () => {
		const { data, error } = await api().GET('/api/v1/routines/{id}', { params: { path: { id } } });
		if (error || !data) {
			loadError = 'Routine not found.';
		} else {
			loaded = {
				title: data.title,
				notes: data.notes,
				exercises: (data.exercises ?? []).map((ex) => ({
					exercise_id: ex.exercise_id,
					rest_seconds: ex.rest_seconds,
					sets: (ex.sets ?? []).map((s) => ({
						set_type: s.set_type,
						target_weight: s.target_weight ?? null,
						target_reps: s.target_reps ?? null
					}))
				}))
			};
		}
		loading = false;
	});

	type RoutinePayload = {
		title: string;
		notes: string;
		exercises: {
			exercise_id: string;
			rest_seconds: number;
			sets: { set_type: string; target_weight?: number; target_reps?: number }[];
		}[];
	};

	async function update(payload: RoutinePayload) {
		const { error } = await api().PATCH('/api/v1/routines/{id}', { params: { path: { id } }, body: payload });
		if (error) throw new Error('Failed to save changes');
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
