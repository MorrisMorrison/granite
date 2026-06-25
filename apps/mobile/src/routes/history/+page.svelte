<script lang="ts">
	import { onMount } from 'svelte';
	import { listWorkouts, type WorkoutSummary } from '$lib/repo/workouts';
	import { syncNow } from '$lib/sync';
	import { startOfDay } from '$lib/calendar';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Calendar from '$lib/components/ui/Calendar.svelte';
	import ListRow from '$lib/components/ui/ListRow.svelte';

	let workouts = $state<WorkoutSummary[]>([]);
	let loading = $state(true);
	let selectedDay = $state<number | null>(null);

	const dates = $derived(workouts.map((w) => w.start_time));
	const shown = $derived(
		selectedDay == null
			? workouts
			: workouts.filter((w) => startOfDay(w.start_time) === selectedDay)
	);

	function fmtDay(ms: number): string {
		return new Date(ms).toLocaleDateString(undefined, {
			weekday: 'long',
			month: 'long',
			day: 'numeric'
		});
	}

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
		<Calendar {dates} selected={selectedDay} onselect={(d) => (selectedDay = d)} />

		{#if selectedDay != null}
			<div class="filterbar">
				<span class="muted">Showing {fmtDay(selectedDay)}</span>
				<button class="link" onclick={() => (selectedDay = null)} data-testid="clear-day">Clear</button>
			</div>
		{/if}

		<div class="list">
			{#each shown as w (w.id)}
				<ListRow
					href={`/history/${w.id}`}
					title={w.title || 'Workout'}
					subtitle={`${fmtDate(w.start_time)}${duration(w)}`}
					testid="workout-row"
				/>
			{/each}
		</div>
	{/if}
</main>

<style>
	.filterbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		font-size: 0.82rem;
		margin-bottom: 0.6rem;
	}
	.list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
</style>
