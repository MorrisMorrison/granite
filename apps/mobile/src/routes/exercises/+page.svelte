<script lang="ts">
	import { onMount } from 'svelte';
	import {
		listArchivedExercises,
		listExercises,
		refreshExerciseLibrary,
		type ExerciseRow
	} from '#lib/repo/exercises.ts';
	import PageHeader from '#lib/components/ui/PageHeader.svelte';
	import Badge from '#lib/components/ui/Badge.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import EmptyState from '#lib/components/ui/EmptyState.svelte';
	import Icon from '#lib/components/ui/Icon.svelte';
	import { filterExercises, groupByMuscle, metaLine } from '#lib/exerciseSearch.ts';

	let exercises = $state<ExerciseRow[]>([]);
	let archived = $state<ExerciseRow[]>([]);
	let showArchived = $state(false);
	let loading = $state(true);
	let query = $state('');

	const filtered = $derived(filterExercises(exercises, query));
	const groups = $derived(groupByMuscle(filtered));
	const filteredArchived = $derived(filterExercises(archived, query));
	const eyebrow = $derived(
		loading ? undefined : `${exercises.length} exercise${exercises.length === 1 ? '' : 's'}`
	);

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
	<PageHeader title="Exercises" {eyebrow}>
		{#snippet action()}
			<Button size="sm" icon="plus" href="/exercises/new" testid="btn-new-exercise">New</Button>
		{/snippet}
	</PageHeader>
	{#if loading}
		<p class="muted">Loading…</p>
	{:else if exercises.length === 0 && archived.length === 0}
		<EmptyState title="No exercises yet" description="Your exercise library will appear here.">
			{#snippet action()}
				<Button href="/exercises/new" icon="plus" testid="btn-new-exercise-empty">New exercise</Button>
			{/snippet}
		</EmptyState>
	{:else}
		<div class="search">
			<span class="search-icon"><Icon name="search" size={18} /></span>
			<input
				class="control"
				type="search"
				placeholder="Search exercises"
				bind:value={query}
				aria-label="Search exercises"
				data-testid="field-exercise-search"
			/>
		</div>

		{#if filtered.length === 0}
			{#if exercises.length > 0}
				<EmptyState title="No matches" description={`No exercises match “${query.trim()}”.`} />
			{/if}
		{:else}
			{#each groups as g (g.muscle)}
				<section class="block">
					<h2 class="eyebrow label">{g.muscle}</h2>
					<div class="group">
						{#each g.items as ex (ex.id)}
							<a class="group-row" href={`/exercises/${ex.id}`} data-testid="exercise-row">
								<span class="group-row-body">
									<span class="group-row-title">{ex.name}</span>
									{#if ex.equipment}<span class="group-row-sub">{ex.equipment}</span>{/if}
								</span>
								{#if !ex.is_builtin}<Badge>Custom</Badge>{/if}
								<span class="group-row-chev"><Icon name="chevron-right" size={18} /></span>
							</a>
						{/each}
					</div>
				</section>
			{/each}
		{/if}

		{#if archived.length > 0}
			<button
				class="archived-toggle"
				onclick={() => (showArchived = !showArchived)}
				aria-expanded={showArchived}
				data-testid="btn-show-archived"
			>
				<Icon name={showArchived ? 'chevron-down' : 'chevron-right'} size={16} />
				Archived · {archived.length}
			</button>
			{#if showArchived}
				{#if filteredArchived.length === 0}
					<p class="muted none">No archived exercises match.</p>
				{:else}
					<div class="group archived">
						{#each filteredArchived as ex (ex.id)}
							<a class="group-row" href={`/exercises/${ex.id}`} data-testid="archived-exercise-row">
								<span class="group-row-body">
									<span class="group-row-title">{ex.name}</span>
									<span class="group-row-sub">{metaLine(ex.primary_muscle, ex.equipment)}</span>
								</span>
								<span class="group-row-chev"><Icon name="chevron-right" size={18} /></span>
							</a>
						{/each}
					</div>
				{/if}
			{/if}
		{/if}
	{/if}
</main>

<style>
	.search {
		position: relative;
		margin-bottom: 1.1rem;
	}
	.search-icon {
		position: absolute;
		left: 0.8rem;
		top: 50%;
		transform: translateY(-50%);
		display: inline-flex;
		color: var(--faint);
		pointer-events: none;
	}
	.search .control {
		padding-left: 2.5rem;
	}
	.block + .block {
		margin-top: 1.1rem;
	}
	.label {
		margin: 0 0 0.4rem;
	}
	.archived-toggle {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		margin: 1.5rem 0 0.5rem;
		padding: 0;
		background: none;
		border: none;
		color: var(--muted);
		font: inherit;
		font-size: 0.85rem;
		font-weight: 600;
		cursor: pointer;
	}
	.archived-toggle:hover {
		color: var(--text);
	}
	.archived .group-row-title {
		font-weight: 550;
		color: var(--muted);
	}
	.none {
		margin: 0;
		font-size: 0.85rem;
	}
</style>
