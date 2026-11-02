<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { listWorkouts, type WorkoutSummary } from '#lib/repo/workouts.ts';
	import { syncNow } from '#lib/sync/index.ts';
	import { inMonth, monthLabel, startOfDay } from '#lib/calendar.ts';
	import { workoutMinutes } from '#lib/duration.ts';
	import PageHeader from '#lib/components/ui/PageHeader.svelte';
	import EmptyState from '#lib/components/ui/EmptyState.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import Calendar from '#lib/components/ui/Calendar.svelte';
	import Icon from '#lib/components/ui/Icon.svelte';

	let workouts = $state<WorkoutSummary[]>([]);
	let loading = $state(true);
	let selectedDay = $state<number | null>(null);
	// The month on the calendar; the list below shows the same month.
	let viewYear = $state(new Date().getFullYear());
	let viewMonth = $state(new Date().getMonth());
	let listEl = $state<HTMLElement | null>(null);

	// The Clear button disappears with the filter, so hand focus to the (now full) list.
	async function clearDay() {
		selectedDay = null;
		await tick();
		listEl?.focus();
	}

	const dates = $derived(workouts.map((w) => w.start_time));
	// A day picked in another month doesn't apply to the month on view.
	const activeDay = $derived(
		selectedDay != null && inMonth(selectedDay, viewYear, viewMonth) ? selectedDay : null
	);
	const shown = $derived(
		workouts.filter((w) =>
			activeDay == null
				? inMonth(w.start_time, viewYear, viewMonth)
				: startOfDay(w.start_time) === activeDay
		)
	);
	const eyebrow = $derived(
		workouts.length ? `${workouts.length} workout${workouts.length === 1 ? '' : 's'}` : undefined
	);

	// Open on the latest workout's month so History isn't empty early in a new month.
	function openOnLatest() {
		if (!workouts.length) return;
		const latest = new Date(Math.max(...workouts.map((w) => w.start_time)));
		viewYear = latest.getFullYear();
		viewMonth = latest.getMonth();
	}

	onMount(async () => {
		workouts = await listWorkouts();
		openOnLatest();
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
		<Calendar
			{dates}
			selected={selectedDay}
			onselect={(d) => (selectedDay = d)}
			bind:year={viewYear}
			bind:month={viewMonth}
		/>

		{#if activeDay != null}
			<div class="filterbar">
				<span>Showing {fmtDay(activeDay)}</span>
				<button class="clear" onclick={clearDay} data-testid="clear-day">Clear</button>
			</div>
		{/if}

		<div class="list" bind:this={listEl} tabindex="-1" role="region" aria-label="Workouts">
			{#if shown.length === 0}
				<p class="none" data-testid="month-empty">
					No workouts in {monthLabel(viewYear, viewMonth)}.
				</p>
			{:else}
				<div class="group">
					{#each shown as w (w.id)}
						<a class="group-row" href={`/history/${w.id}`} data-testid="workout-row">
							<span class="group-row-body">
								<span class="group-row-title">{w.title || 'Workout'}</span>
								<span class="group-row-sub">{meta(w)}</span>
							</span>
							<span class="group-row-chev"><Icon name="chevron-right" size={18} /></span>
						</a>
					{/each}
				</div>
			{/if}
		</div>
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
	.none {
		margin: 0;
		padding: 1.25rem 0;
		text-align: center;
		font-size: 0.9rem;
		color: var(--muted);
	}
	.list:focus {
		outline: none;
	}
	.list:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 4px;
		border-radius: var(--radius-lg);
	}
</style>
