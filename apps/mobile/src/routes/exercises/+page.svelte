<script lang="ts">
	import { onMount } from 'svelte';
	import { listExercises, refreshExerciseLibrary, type ExerciseRow } from '$lib/repo/exercises';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import ListRow from '$lib/components/ui/ListRow.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';

	let exercises = $state<ExerciseRow[]>([]);
	let loading = $state(true);

	onMount(async () => {
		exercises = await listExercises();
		loading = false;
		try {
			await refreshExerciseLibrary();
			exercises = await listExercises();
		} catch {
			/* offline — keep the local library */
		}
	});
</script>

<svelte:head><title>Exercises · Granite</title></svelte:head>

<main class="container">
	<PageHeader title="Exercises" />
	{#if loading}
		<p class="muted">Loading…</p>
	{:else if exercises.length === 0}
		<EmptyState title="No exercises yet" description="Your exercise library will appear here." />
	{:else}
		<div class="list">
			{#each exercises as ex (ex.id)}
				<ListRow
					title={ex.name}
					subtitle={`${ex.primary_muscle} · ${ex.exercise_type}`}
					testid="exercise-row"
				>
					{#snippet trailing()}
						{#if ex.is_builtin}<Badge>built-in</Badge>{/if}
					{/snippet}
				</ListRow>
			{/each}
		</div>
	{/if}
</main>

<style>
	.list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
</style>
