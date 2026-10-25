<script lang="ts">
	import { onMount } from 'svelte';
	import { listWorkouts, type WorkoutSummary } from '#lib/repo/workouts.ts';
	import { syncNow } from '#lib/sync/index.ts';
	import { groupByMonth, startOfDay } from '#lib/calendar.ts';
	import { workoutMinutes } from '#lib/duration.ts';
	import PageHeader from '#lib/components/ui/PageHeader.svelte';
	import EmptyState from '#lib/components/ui/EmptyState.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import Calendar from '#lib/components/ui/Calendar.svelte';
	import Icon from '#lib/components/ui/Icon.svelte';

	let workouts = $state<WorkoutSummary[]>([]);
	let loading = $state(true);
	let selectedDay = $state<number | null>(null);

	const dates = $derived(workouts.map((w) => w.start_time));
	const shown = $derived(
		selectedDay == null
			? workouts
			: workouts.filter((w) => startOfDay(w.start_time) === selectedDay)
	);
	const months = $derived(groupByMonth(shown));
	const eyebrow = $derived(
		workouts.length ? `${workouts.length} workout${workouts.length === 1 ? '' : 's'}` : undefined
	);

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

	function fmtDay(ms: number): string {
		return new Date(ms).toLocaleDateString(undefined, {
			weekday: 'long',
			day: 'numeric',
			month: 'long'
		});
	}

	// "Tue 21 Oct · 18:30 · 58 min" (duration left off while unknown).
	function meta(w: WorkoutSummary): string {
		const d = new Date(w.start_time);
		const day = d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
		const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
		const m = workoutMinutes(w.start_time, w.end_time);
		return [day, time, m ? `${m} min` : ''].filter(Boolean).join(' · ');
	}
</script>

<svelte:head><title>History · Granite</title></svelte:head>

<main class="container">
	<PageHeader title="History" {eyebrow} />
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
				<span>Showing {fmtDay(selectedDay)}</span>
				<button class="clear" onclick={() => (selectedDay = null)} data-testid="clear-day">Clear</button>
			</div>
		{/if}

		{#each months as g (g.key)}
			<section class="month">
				<h2 class="eyebrow month-label">{g.label}</h2>
				<div class="group">
					{#each g.items as w (w.id)}
						<a class="row" href={`/history/${w.id}`} data-testid="workout-row">
							<span class="body">
								<span class="title">{w.title || 'Workout'}</span>
								<span class="sub">{meta(w)}</span>
							</span>
							<span class="chev"><Icon name="chevron-right" size={18} /></span>
						</a>
					{/each}
				</div>
			</section>
		{/each}
	{/if}
</main>

<style>
	.filterbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		margin: 0.1rem 0 0.9rem;
		font-size: 0.85rem;
		color: var(--muted);
	}
	.clear {
		flex-shrink: 0;
		padding: 0.25rem 0.5rem;
		margin-right: -0.5rem;
		font: inherit;
		font-weight: 600;
		color: var(--muted);
		background: none;
		border: none;
		border-radius: var(--radius-sm);
		cursor: pointer;
	}
	.clear:hover {
		color: var(--text);
		background: var(--elevated);
	}
	.month {
		margin-top: 1.25rem;
	}
	.month-label {
		margin: 0 0 0.4rem;
	}
	.group {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		overflow: hidden;
	}
	.group > :global(* + *) {
		border-top: 1px solid var(--border);
	}
	.row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.7rem 0.75rem 0.7rem 1.1rem;
		color: var(--text);
		text-decoration: none;
		transition: background var(--dur-fast) var(--ease);
	}
	.row:hover {
		background: var(--elevated);
	}
	.body {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}
	.title {
		font-weight: 650;
		letter-spacing: -0.01em;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.sub {
		font-size: 0.8rem;
		color: var(--muted);
		font-variant-numeric: tabular-nums;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.chev {
		display: inline-flex;
		flex-shrink: 0;
		color: var(--faint);
	}
</style>
