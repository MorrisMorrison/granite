<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { getExercise, archiveExercise, restoreExercise, type ExerciseRow } from '#lib/repo/exercises.ts';
	import { exerciseProgress, type ExerciseProgress, type SessionStat } from '#lib/repo/stats.ts';
	import { syncNow } from '#lib/sync/index.ts';
	import { prefs } from '#lib/stores/prefs.svelte.ts';
	import { kgToDisplay } from '#lib/units.ts';
	import { metaLine } from '#lib/exerciseSearch.ts';
	import BackLink from '#lib/components/ui/BackLink.svelte';
	import EmptyState from '#lib/components/ui/EmptyState.svelte';
	import LineChart from '#lib/components/ui/LineChart.svelte';
	import Icon from '#lib/components/ui/Icon.svelte';
	import IconButton from '#lib/components/ui/IconButton.svelte';
	import Sheet from '#lib/components/ui/Sheet.svelte';

	const id = page.params.id!;
	let ex = $state<ExerciseRow | null>(null);
	let prog = $state<ExerciseProgress | null>(null);
	let loading = $state(true);
	let menuOpen = $state(false);

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

	async function archive() {
		if (!ex) return;
		menuOpen = false;
		if (!confirm(`Archive “${ex.name}”? It'll be hidden from your library; past workouts keep it.`)) {
			return;
		}
		await archiveExercise(ex.id);
		await goto('/exercises');
	}

	async function restore() {
		if (!ex) return;
		menuOpen = false;
		await restoreExercise(ex.id);
		await load();
	}

	const unit = $derived(prefs.current.weightUnit);
	const num = (kg: number | null) => kgToDisplay(kg, unit);
	function w(kg: number | null): string {
		const v = num(kg);
		return v == null ? '—' : `${v} ${unit}`;
	}
	function fmtDate(ms: number): string {
		return new Date(ms).toLocaleDateString(undefined, {
			weekday: 'short',
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		});
	}
	const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
	// Best set of a session ("100 kg × 5"), or just the set count when nothing was weighed.
	function bestSet(s: SessionStat): string {
		if (s.top_weight == null) return plural(s.sets, 'set');
		return s.top_reps ? `${w(s.top_weight)} × ${s.top_reps}` : w(s.top_weight);
	}
	function sessionMeta(s: SessionStat): string {
		return metaLine(fmtDate(s.date), s.top_weight == null ? '' : plural(s.sets, 'set'));
	}

	const eyebrow = $derived(
		ex ? metaLine(ex.primary_muscle, ex.equipment, ex.is_archived ? 'Archived' : '') : ''
	);
	// Estimated-1RM trend (fall back to top weight), in the display unit.
	const chartValues = $derived(
		(prog?.sessions ?? [])
			.map((s) => num(s.best_1rm ?? s.top_weight))
			.filter((v): v is number => v != null)
	);
	const latestChart = $derived(chartValues.length ? chartValues[chartValues.length - 1] : null);
	const recent = $derived([...(prog?.sessions ?? [])].reverse());
</script>

<svelte:head><title>{ex?.name ?? 'Exercise'} · Granite</title></svelte:head>

<main class="container">
	<BackLink href="/exercises" label="Exercises" />
	{#if loading}
		<p class="muted">Loading…</p>
	{:else if !ex}
		<p class="error">Exercise not found.</p>
	{:else}
		<header class="head" data-testid="exercise-detail">
			<div class="titles">
				{#if eyebrow}<p class="eyebrow">{eyebrow}</p>{/if}
				<h1 class="page-title">{ex.name}</h1>
			</div>
			{#if !ex.is_builtin}
				<IconButton
					name="dots-vertical"
					label="Exercise actions"
					size={20}
					onclick={() => (menuOpen = true)}
					testid="btn-exercise-menu"
				/>
			{/if}
		</header>

		{#if !prog || prog.total_sessions === 0}
			<EmptyState
				icon="history"
				title="No history yet"
				description="Log a workout with this exercise to see progress and PRs."
			/>
		{:else}
			<section class="card summary cols-4 block" aria-label="Personal records">
				<div class="summary-stat">
					<span class="eyebrow">Heaviest</span>
					<span class="summary-val" data-testid="pr-weight">
						<span class="n">{w(prog.pr_weight)}</span>
						{#if prog.pr_weight_reps}<small>× {prog.pr_weight_reps}</small>{/if}
					</span>
				</div>
				<div class="summary-stat">
					<span class="eyebrow">Est. 1RM</span>
					<span class="summary-val" data-testid="pr-1rm"><span class="n">{w(prog.pr_1rm)}</span></span>
				</div>
				<div class="summary-stat">
					<span class="eyebrow">Best volume</span>
					<span class="summary-val"><span class="n">{w(prog.pr_volume)}</span></span>
				</div>
				<div class="summary-stat">
					<span class="eyebrow">Sessions</span>
					<span class="summary-val">{prog.total_sessions}</span>
				</div>
			</section>

			{#if chartValues.length >= 2}
				<section class="card block" data-testid="e1rm-chart">
					<p class="eyebrow">Estimated 1RM</p>
					{#if latestChart != null}
						<p class="headline">
							<span class="big-num">{latestChart} {unit}</span>
							<span class="muted">last session</span>
						</p>
					{/if}
					<div class="chart"><LineChart values={chartValues} label="Estimated 1RM over time" /></div>
				</section>
			{/if}

			<section class="sessions">
				<h2 class="eyebrow label">Sessions</h2>
				<div class="group">
					{#each recent as s (s.workout_id)}
						<a class="group-row" href={`/history/${s.workout_id}`} data-testid="session-row">
							<span class="group-row-body">
								<span class="group-row-title">{bestSet(s)}</span>
								<span class="group-row-sub">{sessionMeta(s)}</span>
							</span>
							{#if s.best_1rm != null}
								<span class="group-row-val">{num(s.best_1rm)} {unit}<small>e1RM</small></span>
							{/if}
							<span class="group-row-chev"><Icon name="chevron-right" size={18} /></span>
						</a>
					{/each}
				</div>
			</section>
		{/if}

		{#if !ex.is_builtin}
			<Sheet open={menuOpen} title={ex.name} onclose={() => (menuOpen = false)}>
				<ul class="menu">
					<li>
						<a class="menu-item" href={`/exercises/${ex.id}/edit`} data-testid="btn-edit-exercise">
							<Icon name="edit" size={16} /> Edit
						</a>
					</li>
					<li>
						{#if ex.is_archived}
							<button class="menu-item" onclick={restore} data-testid="btn-restore-exercise">
								<Icon name="restore" size={16} /> Restore
							</button>
						{:else}
							<button class="menu-item danger" onclick={archive} data-testid="btn-archive-exercise">
								<Icon name="trash" size={16} /> Archive
							</button>
						{/if}
					</li>
				</ul>
			</Sheet>
		{/if}
	{/if}
</main>

<style>
	.head {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 0.75rem;
		margin: 0.25rem 0 1rem;
	}
	.titles {
		min-width: 0;
	}
	.block {
		margin-bottom: 0.75rem;
	}
	.headline {
		display: flex;
		align-items: baseline;
		flex-wrap: wrap;
		gap: 0.2rem 0.45rem;
		margin: 0.3rem 0 0.5rem;
	}
	.headline .muted {
		font-size: 0.85rem;
	}
	.chart {
		margin: 0 -0.3rem;
	}
	.sessions {
		margin-top: 1.25rem;
	}
	.label {
		margin: 0 0 0.4rem;
	}
</style>
