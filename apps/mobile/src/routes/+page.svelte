<script lang="ts">
	import { onMount } from 'svelte';
	import { auth } from '$lib/stores/auth.svelte';
	import { listRoutines, type RoutineRow } from '$lib/repo/routines';
	import { syncNow } from '$lib/sync';
	import Button from '$lib/components/ui/Button.svelte';
	import ListRow from '$lib/components/ui/ListRow.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';

	let routines = $state<RoutineRow[]>([]);

	onMount(async () => {
		routines = await listRoutines();
		try {
			await syncNow();
			routines = await listRoutines();
		} catch {
			/* offline — keep local */
		}
	});

	const name = $derived(
		(auth.user?.display_name?.trim() || auth.user?.email?.split('@')[0] || '').trim()
	);
</script>

<svelte:head><title>Granite</title></svelte:head>

<main class="container">
	<h1>Today</h1>
	<p class="muted greeting">Ready to train{name ? `, ${name}` : ''}?</p>

	<Button href="/log" icon="play" block testid="btn-start-workout">Start workout</Button>

	{#if routines.length > 0}
		<section class="section">
			<div class="section-head">
				<span>Routines</span>
				<a href="/routines">All</a>
			</div>
			<div class="list">
				{#each routines.slice(0, 4) as r (r.id)}
					<ListRow href={`/log?routine=${r.id}`} title={r.title} testid="today-routine-row">
						{#snippet trailing()}<Icon name="play" size={18} />{/snippet}
					</ListRow>
				{/each}
			</div>
		</section>
	{/if}
</main>

<style>
	.greeting {
		margin-top: -0.5rem;
		margin-bottom: 1.25rem;
	}
	.section {
		margin-top: 1.75rem;
	}
	.section-head {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		margin-bottom: 0.6rem;
		font-size: 0.85rem;
		color: var(--muted);
	}
	.list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
</style>
