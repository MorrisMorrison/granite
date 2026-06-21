<script lang="ts">
	import { onMount } from 'svelte';
	import { listRoutines, type RoutineRow } from '$lib/repo/routines';
	import { syncNow } from '$lib/sync';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';

	let routines = $state<RoutineRow[]>([]);
	let loading = $state(true);

	onMount(async () => {
		routines = await listRoutines();
		loading = false;
		try {
			await syncNow();
			routines = await listRoutines();
		} catch {
			/* offline — keep local */
		}
	});
</script>

<svelte:head><title>Routines · Granite</title></svelte:head>

<main class="container">
	<PageHeader title="Routines">
		{#snippet action()}
			<Button href="/routines/new" icon="plus" size="sm" testid="btn-new-routine">New</Button>
		{/snippet}
	</PageHeader>

	{#if loading}
		<p class="muted">Loading…</p>
	{:else if routines.length === 0}
		<EmptyState
			icon="routines"
			title="No routines yet"
			description="Build a routine to start workouts faster."
		>
			{#snippet action()}
				<Button href="/routines/new" icon="plus" testid="btn-new-routine-empty">New routine</Button>
			{/snippet}
		</EmptyState>
	{:else}
		<div class="list">
			{#each routines as r (r.id)}
				<div class="rrow" data-testid="routine-row">
					<a class="rrow-title" href="/routines/{r.id}">{r.title}</a>
					<Button
						href={`/log?routine=${r.id}`}
						variant="secondary"
						size="sm"
						testid="btn-start-routine">Start</Button
					>
				</div>
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
	.rrow {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		padding: 0.85rem 1rem;
	}
	.rrow-title {
		flex: 1;
		min-width: 0;
		font-weight: 600;
		color: var(--text);
		text-decoration: none;
	}
	.rrow-title:hover {
		color: var(--accent);
	}
</style>
