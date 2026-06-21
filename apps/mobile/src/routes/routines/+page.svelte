<script lang="ts">
	import { onMount } from 'svelte';
	import { api } from '$lib/api/client';

	interface RoutineRow {
		id: string;
		title: string;
	}

	let routines = $state<RoutineRow[]>([]);
	let loading = $state(true);
	let error = $state('');

	onMount(async () => {
		const { data, error: err } = await api().GET('/api/v1/routines');
		if (err || !data) {
			error = 'Failed to load routines.';
		} else {
			routines = (data.routines ?? []).map((r) => ({ id: r.id, title: r.title }));
		}
		loading = false;
	});
</script>

<svelte:head><title>Routines · Granite</title></svelte:head>

<main class="container">
	<div class="head">
		<h1>Routines</h1>
		<a class="btn" href="/routines/new">New routine</a>
	</div>
	{#if loading}
		<p class="muted">Loading…</p>
	{:else if error}
		<p class="error">{error}</p>
	{:else if routines.length === 0}
		<div class="card">
			<p class="muted">No routines yet. Build one to start workouts faster.</p>
		</div>
	{:else}
		<ul class="list">
			{#each routines as r (r.id)}
				<li class="card row">
					<a class="name" href="/routines/{r.id}">{r.title}</a>
					<a class="btn" href="/log?routine={r.id}">Start</a>
				</li>
			{/each}
		</ul>
	{/if}
</main>

<style>
	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	.head :global(.btn) {
		padding: 0.4rem 0.8rem;
	}
	.list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.row {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	.name {
		font-weight: 600;
		text-decoration: none;
		color: var(--text);
	}
	.row :global(.btn) {
		padding: 0.4rem 0.9rem;
	}
</style>
