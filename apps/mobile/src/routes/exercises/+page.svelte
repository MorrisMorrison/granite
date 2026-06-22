<script lang="ts">
	import { onMount } from 'svelte';
	import { listExercises, refreshExerciseLibrary, type ExerciseRow } from '$lib/repo/exercises';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import ListRow from '$lib/components/ui/ListRow.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';

	let exercises = $state<ExerciseRow[]>([]);
	let loading = $state(true);
	let query = $state('');

	// Filter by name or primary muscle (case-insensitive). Empty query = all.
	const filtered = $derived.by(() => {
		const q = query.trim().toLowerCase();
		if (!q) return exercises;
		return exercises.filter(
			(e) => e.name.toLowerCase().includes(q) || e.primary_muscle.toLowerCase().includes(q)
		);
	});

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
		<input
			class="search"
			type="search"
			placeholder="Search exercises…"
			bind:value={query}
			aria-label="Search exercises"
			data-testid="field-exercise-search"
		/>
		{#if filtered.length === 0}
			<EmptyState title="No matches" description={`No exercises match “${query.trim()}”.`} />
		{:else}
			<div class="list">
				{#each filtered as ex (ex.id)}
					<ListRow
						href={`/exercises/${ex.id}`}
						title={ex.name}
						subtitle={`${ex.primary_muscle} · ${ex.exercise_type}`}
						chevron
						testid="exercise-row"
					>
						{#snippet trailing()}
							{#if ex.is_builtin}<Badge>built-in</Badge>{/if}
						{/snippet}
					</ListRow>
				{/each}
			</div>
		{/if}
	{/if}
</main>

<style>
	.search {
		width: 100%;
		margin-bottom: 0.85rem;
	}
	.list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
</style>
