<script lang="ts">
	import { onMount } from 'svelte';
	import { listExercises, refreshExerciseLibrary, type ExerciseRow } from '$lib/repo/exercises';

	let exercises = $state<ExerciseRow[]>([]);
	let loading = $state(true);
	let error = $state('');

	onMount(async () => {
		// Local-first: show the cached library immediately (works offline)...
		exercises = await listExercises();
		loading = false;
		// ...then refresh from the server (incl. built-ins) when online.
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
	<h1>Exercises</h1>
	{#if loading}
		<p class="muted">Loading…</p>
	{:else if error}
		<p class="error">{error}</p>
	{:else if exercises.length === 0}
		<p class="muted">No exercises yet.</p>
	{:else}
		<ul class="list">
			{#each exercises as ex (ex.id)}
				<li class="card row">
					<div>
						<div class="name">{ex.name}</div>
						<div class="muted meta">{ex.primary_muscle} · {ex.exercise_type}</div>
					</div>
					{#if ex.is_builtin}<span class="badge">built-in</span>{/if}
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
	.row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.75rem 1rem;
	}
	.name {
		font-weight: 600;
	}
	.meta {
		font-size: 0.85rem;
	}
	.badge {
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--muted);
		border: 1px solid var(--border);
		border-radius: 999px;
		padding: 0.1rem 0.5rem;
	}
</style>
