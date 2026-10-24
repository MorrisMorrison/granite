<script lang="ts">
	import { onMount } from 'svelte';
	import {
		listArchivedExercises,
		listExercises,
		refreshExerciseLibrary,
		type ExerciseRow
	} from '#lib/repo/exercises.ts';
	import PageHeader from '#lib/components/ui/PageHeader.svelte';
	import ListRow from '#lib/components/ui/ListRow.svelte';
	import Badge from '#lib/components/ui/Badge.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import EmptyState from '#lib/components/ui/EmptyState.svelte';
	import Icon from '#lib/components/ui/Icon.svelte';
	import { filterExercises } from '#lib/exerciseSearch.ts';

	let exercises = $state<ExerciseRow[]>([]);
	let archived = $state<ExerciseRow[]>([]);
	let showArchived = $state(false);
	let loading = $state(true);
	let query = $state('');

	const filtered = $derived(filterExercises(exercises, query));
	const filteredArchived = $derived(filterExercises(archived, query));

	async function load() {
		[exercises, archived] = await Promise.all([listExercises(), listArchivedExercises()]);
	}

	onMount(async () => {
		await load();
		loading = false;
		try {
			await refreshExerciseLibrary();
			await load();
		} catch {
			/* offline — keep the local library */
		}
	});
</script>

<svelte:head><title>Exercises · Granite</title></svelte:head>

<main class="container">
	<PageHeader title="Exercises">
		{#snippet action()}
			<Button size="sm" icon="plus" href="/exercises/new" testid="btn-new-exercise">New</Button>
		{/snippet}
	</PageHeader>
	{#if loading}
		<p class="muted">Loading…</p>
	{:else if exercises.length === 0}
		<EmptyState title="No exercises yet" description="Your exercise library will appear here.">
			{#snippet action()}
				<Button href="/exercises/new" icon="plus" testid="btn-new-exercise-empty">New exercise</Button>
			{/snippet}
		</EmptyState>
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
		{#if archived.length > 0}
			<button
				class="archived-toggle"
				onclick={() => (showArchived = !showArchived)}
				aria-expanded={showArchived}
				data-testid="btn-show-archived"
			>
				<Icon name={showArchived ? 'chevron-down' : 'chevron-right'} size={16} />
				Archived ({archived.length})
			</button>
			{#if showArchived}
				<div class="list">
					{#each filteredArchived as ex (ex.id)}
						<ListRow
							href={`/exercises/${ex.id}`}
							title={ex.name}
							subtitle={`${ex.primary_muscle} · ${ex.exercise_type}`}
							chevron
							testid="archived-exercise-row"
						>
							{#snippet trailing()}<Badge>archived</Badge>{/snippet}
						</ListRow>
					{:else}
						<p class="muted">No archived exercises match.</p>
					{/each}
				</div>
			{/if}
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
	.archived-toggle {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		margin: 1.25rem 0 0.6rem;
		padding: 0;
		background: none;
		border: none;
		color: var(--muted);
		font: inherit;
		font-size: 0.85rem;
		cursor: pointer;
	}
</style>
