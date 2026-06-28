<script lang="ts">
	import { onMount } from 'svelte';
	import { allTimeRecordsBoard, type AllTimeRecordRow } from '$lib/repo/analytics';
	import { syncNow } from '$lib/sync';
	import { prefs } from '$lib/stores/prefs.svelte';
	import BackLink from '$lib/components/ui/BackLink.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import RecordList from '$lib/components/RecordList.svelte';

	let records = $state<AllTimeRecordRow[]>([]);
	let loading = $state(true);
	const unit = $derived(prefs.current.weightUnit);

	async function load() {
		records = await allTimeRecordsBoard(1000); // the full board, not just the headline few
	}
	onMount(async () => {
		await load();
		loading = false;
		try {
			await syncNow();
			await load();
		} catch {
			/* offline — keep local */
		}
	});
</script>

<svelte:head><title>All-time records · Granite</title></svelte:head>

<main class="container">
	<BackLink href="/stats" label="Stats" />
	<h1>All-time records</h1>
	{#if loading}
		<p class="muted">Loading…</p>
	{:else if records.length === 0}
		<EmptyState
			icon="history"
			title="No records yet"
			description="Log a few workouts and your best lifts will show up here."
		/>
	{:else}
		<p class="muted sub">Your best estimated 1RM for every lift.</p>
		<RecordList rows={records} {unit} />
	{/if}
</main>

<style>
	h1 {
		font-size: 1.4rem;
		margin: 0.25rem 0 0.5rem;
	}
	.sub {
		font-size: 0.85rem;
		margin: 0 0 1rem;
	}
</style>
