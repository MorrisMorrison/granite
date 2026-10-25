<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { getWorkout, deleteWorkout, type WorkoutDetail } from '#lib/repo/workouts.ts';
	import { nearestBodyweight } from '#lib/repo/bodyweight.ts';
	import { syncNow } from '#lib/sync/index.ts';
	import { prefs } from '#lib/stores/prefs.svelte.ts';
	import { kgToDisplay } from '#lib/units.ts';
	import { setBadge } from '#lib/sets.ts';
	import { workoutMinutes } from '#lib/duration.ts';
	import BackLink from '#lib/components/ui/BackLink.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import Icon from '#lib/components/ui/Icon.svelte';
	import SetBadge from '#lib/components/ui/SetBadge.svelte';

	const id = page.params.id!;
	let workout = $state<WorkoutDetail | null>(null);
	let bodyweight = $state<number | null>(null);
	let loading = $state(true);

	async function load() {
		workout = await getWorkout(id);
		if (workout) {
			const bw = await nearestBodyweight(workout.start_time);
			bodyweight = bw ? bw.weight : null;
		}
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

	async function remove() {
		if (!confirm('Delete this workout? This cannot be undone.')) return;
		await deleteWorkout(id);
		await goto('/history');
	}

	const unit = $derived(prefs.current.weightUnit);
	function w(kg: number | null): string {
		const v = kgToDisplay(kg, unit);
		return v == null ? '—' : String(v);
	}
	// "Tue 21 Oct 2026 · 18:30"
	function fmtWhen(ms: number): string {
		const d = new Date(ms);
		const day = d.toLocaleDateString(undefined, {
			weekday: 'short',
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		});
		const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
		return `${day} · ${time}`;
	}
	function srSet(label: string, s: { weight: number | null; reps: number | null; is_completed: boolean }): string {
		const parts = [`Set ${label}`];
		if (s.weight != null) parts.push(`${w(s.weight)} ${unit}`);
		if (s.reps != null) parts.push(`${s.reps} reps`);
		if (!s.is_completed) parts.push('skipped');
		return parts.join(', ');
	}
	const minutes = $derived(workout ? workoutMinutes(workout.start_time, workout.end_time) : null);
	const bwDisplay = $derived(bodyweight != null ? kgToDisplay(bodyweight, unit) : null);

	// Sets actually done (warm-ups included, skipped sets not), so the counts agree with
	// the muted "skipped" rows below.
	const doneSets = (sets: { is_completed: boolean }[]) => sets.filter((s) => s.is_completed).length;
	const totalSets = $derived(
		workout ? workout.exercises.reduce((n, e) => n + doneSets(e.sets), 0) : 0
	);
	// Volume in kg, converted to the display unit and rounded. Working-set tonnage
	// only: completed (unchecked skipped) and not a warm-up — matches stats/analytics.
	const totalVolume = $derived(
		workout
			? Math.round(
					kgToDisplay(
						workout.exercises.reduce(
							(vol, e) =>
								vol +
								e.sets.reduce(
									(s, set) =>
										set.is_completed !== false && set.set_type !== 'warmup'
											? s + (set.weight ?? 0) * (set.reps ?? 0)
											: s,
									0
								),
							0
						),
						unit
					) ?? 0
				)
			: 0
	);
</script>

<svelte:head><title>{workout?.title || 'Workout'} · Granite</title></svelte:head>

<main class="container">
	<BackLink href="/history" label="History" />
	{#if loading}
		<p class="muted">Loading…</p>
	{:else if !workout}
		<p class="error">Workout not found.</p>
	{:else}
		<div data-testid="workout-detail">
			<header class="head">
				<p class="eyebrow when">{fmtWhen(workout.start_time)}</p>
				<h1>{workout.title || 'Workout'}</h1>
			</header>

			<section class="card summary {bwDisplay != null ? 'cols-4' : 'cols-3'}" aria-label="Summary">
				<div class="summary-stat">
					<span class="eyebrow">Duration</span>
					<span class="summary-val">{minutes ? `${minutes} min` : '—'}</span>
				</div>
				<div class="summary-stat">
					<span class="eyebrow">Sets</span>
					<span class="summary-val">{totalSets}</span>
				</div>
				<div class="summary-stat">
					<span class="eyebrow">Volume</span>
					<span class="summary-val"><span class="n">{totalVolume.toLocaleString()}</span> <small>{unit}</small></span>
				</div>
				{#if bwDisplay != null}
					<div class="summary-stat" data-testid="wd-bodyweight">
						<span class="eyebrow">Bodyweight</span>
						<span class="summary-val"><span class="n">{bwDisplay}</span> <small>{unit}</small></span>
					</div>
				{/if}
			</section>

			{#if workout.exercises.length === 0}
				<p class="muted">No exercises were logged in this session.</p>
			{/if}

			{#each workout.exercises as ex (ex.id)}
				{@const done = doneSets(ex.sets)}
				<section class="card ex" data-testid="wd-exercise">
					<div class="ex-head">
						<a
							class="ex-link"
							href="/exercises/{ex.exercise_id}"
							data-testid="wd-exercise-link"
							title="View progress for {ex.name}"
						>
							<span class="ex-name">{ex.name}</span>
							<Icon name="chevron-right" size={16} />
						</a>
						<span class="ex-count">{done} set{done === 1 ? '' : 's'}</span>
					</div>
					<div class="cols table-head" aria-hidden="true">
						<span>Set</span><span>{unit}</span><span>Reps</span><span></span>
					</div>
					{#each ex.sets as s, i (i)}
						{@const label = setBadge(ex.sets, i)}
						<div class="set-row" class:skipped={!s.is_completed} data-testid="wd-set">
							<!-- One spoken line per set ("Set W, 60 kg, 8 reps, skipped"); the grid cells are visual only. -->
							<span class="sr-only">{srSet(label, s)}</span>
							<span class="cell" aria-hidden="true"><SetBadge {label} type={s.set_type} /></span>
							<span class="num" aria-hidden="true">{w(s.weight)}</span>
							<span class="num" aria-hidden="true">{s.reps ?? '—'}</span>
							<span class="note" aria-hidden="true">{s.is_completed ? '' : 'skipped'}</span>
						</div>
					{/each}
				</section>
			{/each}

			{#if workout.notes}
				<section class="card notes">
					<p class="eyebrow">Notes</p>
					<p class="notes-text">{workout.notes}</p>
				</section>
			{/if}

			<div class="danger-zone">
				<Button variant="danger" icon="trash" block onclick={remove} testid="btn-delete-workout">
					Delete workout
				</Button>
			</div>
		</div>
	{/if}
</main>

<style>
	.head {
		margin: 0.25rem 0 1rem;
	}
	.when {
		font-variant-numeric: tabular-nums;
	}
	.head h1 {
		margin: 0.2rem 0 0;
		font-size: 1.6rem;
		font-weight: 650;
		letter-spacing: -0.02em;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	/* Card spacing only; the grid comes from the global .summary (2 × 2 on small phones
	   so a 6-digit volume like "112,450 lb" is never cut off). */
	.summary {
		margin-bottom: 0.9rem;
	}
	.ex {
		margin-bottom: 0.9rem;
		padding: 0.85rem 0.9rem 0.6rem;
	}
	.ex-head {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.75rem;
	}
	.ex-link {
		min-width: 0;
		display: inline-flex;
		align-items: center;
		gap: 0.2rem;
		color: var(--text);
		text-decoration: none;
	}
	.ex-name {
		min-width: 0;
		font-weight: 650;
		letter-spacing: -0.01em;
		font-size: 1.02rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.ex-link :global(svg) {
		flex-shrink: 0;
		color: var(--faint);
	}
	.ex-link:hover :global(svg) {
		color: var(--text);
	}
	.ex-count {
		flex-shrink: 0;
		font-size: 0.75rem;
		color: var(--muted);
		font-variant-numeric: tabular-nums;
	}
	.cols,
	.set-row {
		display: grid;
		grid-template-columns: 2rem minmax(0, 1fr) minmax(0, 1fr) 3.5rem;
		gap: 0.4rem;
		align-items: center;
	}
	.cols {
		margin: 0.6rem 0 0.35rem;
	}
	.set-row {
		position: relative;
		min-height: 2.4rem;
		margin-bottom: 0.15rem;
	}
	.num {
		text-align: center;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}
	.note {
		text-align: right;
		font-size: 0.72rem;
		color: var(--faint);
	}
	/* Completed is the normal state; a set that wasn't done reads quieter. */
	.cell {
		display: inline-flex;
	}
	.set-row.skipped .cell,
	.set-row.skipped .num {
		opacity: 0.45;
	}
	.notes {
		margin-bottom: 0.9rem;
	}
	.notes-text {
		margin: 0.35rem 0 0;
		font-size: 0.92rem;
		white-space: pre-wrap;
	}
	.danger-zone {
		margin-top: 1.5rem;
	}
</style>
