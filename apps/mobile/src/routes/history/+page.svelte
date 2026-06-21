<script lang="ts">
	import { onMount } from 'svelte';
	import { listWorkouts, type WorkoutSummary } from '$lib/repo/workouts';
	import { syncNow } from '$lib/sync';

	let workouts = $state<WorkoutSummary[]>([]);
	let loading = $state(true);
	let error = $state('');

	onMount(async () => {
		// Local-first: show what we have immediately (works offline)...
		workouts = await listWorkouts();
		loading = false;
		// ...then refresh from the server in the background if we're online.
		try {
			await syncNow();
			workouts = await listWorkouts();
		} catch {
			/* offline — keep showing local data */
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
	<h1>History</h1>
	{#if loading}
		<p class="muted">Loading…</p>
	{:else if error}
		<p class="error">{error}</p>
	{:else if workouts.length === 0}
		<div class="card">
			<p class="muted">No workouts yet.</p>
			<a class="btn" href="/log">Start your first workout</a>
		</div>
	{:else}
		<ul class="list">
			{#each workouts as w (w.id)}
				<li class="card">
					<div class="name">{w.title || 'Workout'}</div>
					<div class="muted meta">{fmtDate(w.start_time)}{duration(w)}</div>
				</li>
			{/each}
		</ul>
	{/if}
</main>

<style>
	.list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.name {
		font-weight: 600;
	}
	.meta {
		font-size: 0.85rem;
	}
</style>
