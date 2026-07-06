<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { getWorkout, deleteWorkout, type WorkoutDetail } from '$lib/repo/workouts';
	import { nearestBodyweight } from '$lib/repo/bodyweight';
	import { syncNow } from '$lib/sync';
	import { prefs } from '$lib/stores/prefs.svelte';
	import { kgToDisplay } from '$lib/units';
	import { setLabel } from '$lib/sets';
	import BackLink from '$lib/components/ui/BackLink.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';

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
	function fmtDate(ms: number): string {
		return new Date(ms).toLocaleString(undefined, {
			weekday: 'short',
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}
	function durationMin(wd: WorkoutDetail): number | null {
		if (!wd.end_time) return null;
		const m = Math.round((wd.end_time - wd.start_time) / 60000);
		return m > 0 ? m : null;
	}

	const totalSets = $derived(
		workout ? workout.exercises.reduce((n, e) => n + e.sets.length, 0) : 0
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
			<h1>{workout.title || 'Workout'}</h1>
			<p class="muted sub">
				{fmtDate(workout.start_time)}{#if durationMin(workout)} · {durationMin(workout)} min{/if}
			</p>
			<p class="muted summary">
				{workout.exercises.length} exercise{workout.exercises.length === 1 ? '' : 's'} · {totalSets} set{totalSets ===
				1
					? ''
					: 's'} · {totalVolume} {unit} volume
			</p>
			{#if bodyweight != null}
				<p class="muted summary" data-testid="wd-bodyweight">
					Bodyweight {kgToDisplay(bodyweight, unit)} {unit}
				</p>
			{/if}

			{#if workout.exercises.length === 0}
				<p class="muted">No exercises were logged in this session.</p>
			{/if}

			{#each workout.exercises as ex (ex.id)}
				<section class="card ex" data-testid="wd-exercise">
					<div class="ex-head">
						<a
							class="ex-link"
							href="/exercises/{ex.exercise_id}"
							data-testid="wd-exercise-link"
							title="View progress for {ex.name}"
						>
							<strong>{ex.name}</strong>
							<Icon name="chevron-right" size={16} />
						</a>
						<span class="muted">{ex.sets.length} set{ex.sets.length === 1 ? '' : 's'}</span>
					</div>
					<div class="set-head muted">
						<span>Set</span><span>Type</span><span>{unit}</span><span>Reps</span><span>✓</span>
					</div>
					{#each ex.sets as s, i (i)}
						<div
							class="set-row"
							class:done={s.is_completed}
							class:warmup={s.set_type === 'warmup'}
							data-testid="wd-set"
						>
							<span class="set-no">{setLabel(ex.sets, i)}</span>
							<span>{s.set_type}</span>
							<span>{w(s.weight)}</span>
							<span>{s.reps ?? '—'}</span>
							<span>{s.is_completed ? '✓' : ''}</span>
						</div>
					{/each}
				</section>
			{/each}

			{#if workout.notes}
				<section class="card notes">
					<div class="muted label">Notes</div>
					<p>{workout.notes}</p>
				</section>
			{/if}

			<div class="danger-zone">
				<Button variant="destructive" icon="trash" onclick={remove} testid="btn-delete-workout">
					Delete workout
				</Button>
			</div>
		</div>
	{/if}
</main>

<style>
	h1 {
		margin: 0;
	}
	.sub {
		margin: 0.25rem 0 0.1rem;
	}
	.summary {
		font-size: 0.85rem;
		margin: 0 0 1.25rem;
	}
	.ex {
		margin-bottom: 1rem;
	}
	.ex-head {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.5rem;
	}
	.ex-link {
		display: inline-flex;
		align-items: center;
		gap: 0.2rem;
		color: var(--text);
		text-decoration: none;
	}
	.ex-link:hover {
		color: var(--accent);
	}
	.ex-link :global(svg) {
		color: var(--muted);
	}
	.set-head,
	.set-row {
		display: grid;
		grid-template-columns: 1.5rem 5rem 1fr 1fr 1.5rem;
		gap: 0.4rem;
		align-items: center;
		font-size: 0.85rem;
	}
	.set-head {
		margin-bottom: 0.3rem;
	}
	.set-row {
		margin-bottom: 0.3rem;
		text-transform: capitalize;
	}
	.set-row.done {
		opacity: 0.75;
	}
	.set-no {
		font-variant-numeric: tabular-nums;
	}
	.set-row.warmup .set-no {
		color: var(--warning);
		font-weight: 600;
	}
	.danger-zone {
		margin-top: 1.5rem;
	}
	.notes p {
		margin: 0.25rem 0 0;
		white-space: pre-wrap;
	}
	.notes .label {
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}
</style>
