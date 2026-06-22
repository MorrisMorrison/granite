<script lang="ts">
	import { onMount } from 'svelte';
	import { listWorkouts, type WorkoutSummary } from '$lib/repo/workouts';
	import { syncNow } from '$lib/sync';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import Button from '$lib/components/ui/Button.svelte';

	let workouts = $state<WorkoutSummary[]>([]);
	let loading = $state(true);

	onMount(async () => {
		workouts = await listWorkouts();
		loading = false;
		try {
			await syncNow();
			workouts = await listWorkouts();
		} catch {
			/* offline — keep local */
		}
	});

	function fmtDate(ms: number): string {
		return new Date(ms).toLocaleString(undefined, {
			weekday: 'short',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function duration(w: WorkoutSummary): string {
		if (!w.end_time) return '';
		const mins = Math.round((w.end_time - w.start_time) / 60000);
		return mins > 0 ? ` · ${mins} min` : '';
	}
</script>

<svelte:head><title>History · Granite</title></svelte:head>

<main class="container">
	<PageHeader title="History" />
	{#if loading}
		<p class="muted">Loading…</p>
	{:else if workouts.length === 0}
		<EmptyState
			icon="history"
			title="No workouts yet"
			description="Your logged sessions will show up here."
		>
			{#snippet action()}
				<Button href="/log" icon="play" testid="btn-start-first">Start a workout</Button>
			{/snippet}
		</EmptyState>
	{:else}
		<div class="list">
			{#each workouts as w (w.id)}
				<a class="card item" href="/history/{w.id}" data-testid="workout-row">
					<div class="name">{w.title || 'Workout'}</div>
					<div class="muted meta">{fmtDate(w.start_time)}{duration(w)}</div>
				</a>
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
	.item {
		display: block;
		padding: 0.85rem 1rem;
		color: var(--text);
		text-decoration: none;
	}
	.item:hover {
		border-color: var(--border-strong);
	}
	.name {
		font-weight: 600;
	}
	.meta {
		font-size: 0.82rem;
		margin-top: 2px;
	}
</style>
