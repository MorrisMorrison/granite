<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { getExercise, type ExerciseRow } from '$lib/repo/exercises';
	import { exerciseProgress, type ExerciseProgress } from '$lib/repo/stats';
	import { syncNow } from '$lib/sync';
	import { prefs } from '$lib/stores/prefs.svelte';
	import { kgToDisplay } from '$lib/units';
	import BackLink from '$lib/components/ui/BackLink.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import LineChart from '$lib/components/ui/LineChart.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';

	const id = page.params.id!;
	let ex = $state<ExerciseRow | null>(null);
	let prog = $state<ExerciseProgress | null>(null);
	let loading = $state(true);

	async function load() {
		[ex, prog] = await Promise.all([getExercise(id), exerciseProgress(id)]);
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

	const unit = $derived(prefs.current.weightUnit);
	function w(kg: number | null): string {
		const v = kgToDisplay(kg, unit);
		return v == null ? '—' : `${v} ${unit}`;
	}
	function fmtDate(ms: number): string {
		return new Date(ms).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
	}
	// Estimated-1RM trend (fall back to top weight), in the display unit.
	const chartValues = $derived(
		(prog?.sessions ?? [])
			.map((s) => kgToDisplay(s.best_1rm ?? s.top_weight, unit))
			.filter((v): v is number => v != null)
	);
</script>

<svelte:head><title>{ex?.name ?? 'Exercise'} · Granite</title></svelte:head>

<main class="container">
	<BackLink href="/exercises" label="Exercises" />
	{#if loading}
		<p class="muted">Loading…</p>
	{:else if !ex}
		<p class="error">Exercise not found.</p>
	{:else}
		<div class="head" data-testid="exercise-detail">
			<h1>{ex.name}</h1>
			{#if ex.is_builtin}<Badge>built-in</Badge>{/if}
		</div>
		<p class="muted sub">
			{ex.primary_muscle}{ex.primary_muscle && ex.exercise_type ? ' · ' : ''}{ex.exercise_type}
		</p>

		{#if !prog || prog.total_sessions === 0}
			<EmptyState
				icon="history"
				title="No history yet"
				description="Log a workout with this exercise to see progress and PRs."
			/>
		{:else}
			<section class="prs">
				<div class="pr">
					<div class="pr-label">Heaviest</div>
					<div class="pr-val" data-testid="pr-weight">
						{w(prog.pr_weight)}{#if prog.pr_weight_reps}<span class="x"> × {prog.pr_weight_reps}</span>{/if}
					</div>
				</div>
				<div class="pr">
					<div class="pr-label">Est. 1RM</div>
					<div class="pr-val" data-testid="pr-1rm">{w(prog.pr_1rm)}</div>
				</div>
				<div class="pr">
					<div class="pr-label">Best volume</div>
					<div class="pr-val">{w(prog.pr_volume)}</div>
				</div>
				<div class="pr">
					<div class="pr-label">Sessions</div>
					<div class="pr-val">{prog.total_sessions}</div>
				</div>
			</section>

			{#if chartValues.length >= 2}
				<section class="card chart-card">
					<div class="chart-title muted">Estimated 1RM ({unit})</div>
					<LineChart values={chartValues} label="Estimated 1RM over time" />
				</section>
			{/if}

			<section class="sessions">
				<div class="muted sec-label">Recent sessions</div>
				<div class="list">
					{#each [...prog.sessions].reverse() as s (s.workout_id)}
						<div class="card srow" data-testid="session-row">
							<div class="s-date">{fmtDate(s.date)}</div>
							<div class="s-meta muted">
								{w(s.top_weight)}{#if s.top_reps} × {s.top_reps}{/if} · e1RM {w(s.best_1rm)}
							</div>
						</div>
					{/each}
				</div>
			</section>
		{/if}
	{/if}
</main>

<style>
	.head {
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}
	.head h1 {
		margin: 0;
	}
	.sub {
		margin: 0.25rem 0 1.25rem;
		text-transform: capitalize;
	}
	.prs {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.5rem;
		margin-bottom: 1rem;
	}
	.pr {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		padding: 0.75rem 0.9rem;
	}
	.pr-label {
		font-size: 0.72rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--faint);
	}
	.pr-val {
		font-weight: 600;
		font-size: 1.05rem;
		margin-top: 2px;
	}
	.pr-val .x {
		color: var(--muted);
		font-weight: 400;
		font-size: 0.9rem;
	}
	.chart-card {
		padding: 0.9rem 1rem;
		margin-bottom: 1rem;
	}
	.chart-title {
		font-size: 0.8rem;
		margin-bottom: 0.5rem;
	}
	.sec-label {
		font-size: 0.85rem;
		margin-bottom: 0.5rem;
	}
	.list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.srow {
		padding: 0.7rem 1rem;
	}
	.s-date {
		font-weight: 600;
	}
	.s-meta {
		font-size: 0.82rem;
		margin-top: 2px;
	}
</style>
