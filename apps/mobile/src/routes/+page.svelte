<script lang="ts">
	import { onMount } from 'svelte';
	import { auth } from '$lib/stores/auth.svelte';
	import { listRoutines, type RoutineRow } from '$lib/repo/routines';
	import { listWorkouts } from '$lib/repo/workouts';
	import { computeHomeStats, type HomeStats } from '$lib/stats';
	import { syncNow } from '$lib/sync';
	import Button from '$lib/components/ui/Button.svelte';
	import ListRow from '$lib/components/ui/ListRow.svelte';
	import IconButton from '$lib/components/ui/IconButton.svelte';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';

	let routines = $state<RoutineRow[]>([]);
	let stats = $state<HomeStats | null>(null);

	async function load() {
		const [r, workouts] = await Promise.all([listRoutines(), listWorkouts()]);
		routines = r;
		stats = computeHomeStats(workouts, Date.now());
	}

	onMount(async () => {
		await load();
		try {
			await syncNow();
			await load();
		} catch {
			/* offline — keep local */
		}
	});

	function lastWorkoutLabel(ts: number | null): string {
		if (!ts) return '';
		const days = Math.floor((Date.now() - ts) / 86400000);
		if (days <= 0) return 'Last workout: today';
		if (days === 1) return 'Last workout: yesterday';
		if (days < 7) return `Last workout: ${days} days ago`;
		const weeks = Math.floor(days / 7);
		return `Last workout: ${weeks} week${weeks === 1 ? '' : 's'} ago`;
	}

	const name = $derived(
		(auth.user?.display_name?.trim() || auth.user?.email?.split('@')[0] || '').trim()
	);
	const greeting = $derived(`Ready to train${name ? `, ${name}` : ''}?`);
</script>

<svelte:head><title>Granite</title></svelte:head>

<main class="container">
	<PageHeader title="Today" subtitle={greeting} />

	{#if stats && stats.total > 0}
		<section class="stats" data-testid="home-stats">
			<div class="stat">
				<span class="stat-n" data-testid="stat-this-week">{stats.thisWeek}</span>
				<span class="stat-l">This week</span>
			</div>
			<div class="stat">
				<span class="stat-n" data-testid="stat-streak">{stats.streakWeeks}</span>
				<span class="stat-l">Week streak</span>
			</div>
			<div class="stat">
				<span class="stat-n" data-testid="stat-total">{stats.total}</span>
				<span class="stat-l">Total</span>
			</div>
		</section>
		{#if stats.lastWorkoutAt}
			<p class="muted last-workout">{lastWorkoutLabel(stats.lastWorkoutAt)}</p>
		{/if}
	{/if}

	<Button href="/log" icon="play" block testid="btn-start-workout">Start workout</Button>

	{#if routines.length > 0}
		<section class="section">
			<div class="section-head">
				<span>Routines</span>
				<a href="/routines">All</a>
			</div>
			<div class="list">
				{#each routines.slice(0, 4) as r (r.id)}
					<ListRow href={`/routines/${r.id}`} title={r.title} testid="today-routine-row">
						{#snippet trailing()}
							<IconButton
								name="play"
								size={18}
								label={`Start ${r.title}`}
								href={`/log?routine=${r.id}`}
								testid="today-start-routine"
							/>
						{/snippet}
					</ListRow>
				{/each}
			</div>
		</section>
	{/if}
</main>

<style>
	.stats {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 0.5rem;
		margin-bottom: 0.6rem;
	}
	.stat {
		background: var(--surface-2);
		border-radius: var(--radius);
		padding: 0.75rem 0.5rem;
		text-align: center;
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}
	.stat-n {
		font-size: 1.4rem;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}
	.stat-l {
		font-size: 0.75rem;
		color: var(--muted);
	}
	.last-workout {
		font-size: 0.8rem;
		margin: 0 0 1.25rem;
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
