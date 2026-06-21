<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { listExercises } from '$lib/repo/exercises';
	import { getRoutine } from '$lib/repo/routines';
	import { logWorkout } from '$lib/repo/workouts';

	interface DraftSet {
		uid: string;
		set_type: string;
		weight: number | null;
		reps: number | null;
		is_completed: boolean;
	}
	interface DraftExercise {
		uid: string;
		exercise_id: string;
		name: string;
		sets: DraftSet[];
	}

	let title = $state('');
	let exercises = $state<DraftExercise[]>([]);
	let saving = $state(false);
	let error = $state('');
	let fromRoutineId: string | undefined = $state(undefined);
	const startTime = Date.now();

	const setTypes = ['normal', 'warmup', 'drop', 'failure'];

	// --- exercise picker ---
	let pickerOpen = $state(false);
	let library = $state<{ id: string; name: string; primary_muscle: string }[]>([]);
	let libraryLoaded = $state(false);

	async function openPicker() {
		pickerOpen = true;
		if (!libraryLoaded) {
			library = (await listExercises()).map((e) => ({
				id: e.id,
				name: e.name,
				primary_muscle: e.primary_muscle
			}));
			libraryLoaded = true;
		}
	}

	function addExercise(ex: { id: string; name: string }) {
		exercises.push({
			uid: crypto.randomUUID(),
			exercise_id: ex.id,
			name: ex.name,
			sets: [blankSet()]
		});
		pickerOpen = false;
	}

	function blankSet(from?: DraftSet): DraftSet {
		return {
			uid: crypto.randomUUID(),
			set_type: 'normal',
			weight: from?.weight ?? null,
			reps: from?.reps ?? null,
			is_completed: false
		};
	}

	function addSet(ex: DraftExercise) {
		ex.sets.push(blankSet(ex.sets[ex.sets.length - 1]));
	}
	function removeSet(ex: DraftExercise, uid: string) {
		ex.sets = ex.sets.filter((s) => s.uid !== uid);
	}
	function removeExercise(uid: string) {
		exercises = exercises.filter((e) => e.uid !== uid);
	}

	function toggleComplete(s: DraftSet) {
		s.is_completed = !s.is_completed;
		if (s.is_completed) startRest(90);
	}

	// --- rest timer ---
	let restRemaining = $state(0);
	let restActive = $state(false);
	let restInterval: ReturnType<typeof setInterval> | null = null;

	function startRest(seconds: number) {
		restRemaining = seconds;
		restActive = true;
		if (restInterval) clearInterval(restInterval);
		restInterval = setInterval(() => {
			restRemaining -= 1;
			if (restRemaining <= 0) stopRest();
		}, 1000);
	}
	function bumpRest(delta: number) {
		restRemaining = Math.max(0, restRemaining + delta);
	}
	function stopRest() {
		restActive = false;
		if (restInterval) {
			clearInterval(restInterval);
			restInterval = null;
		}
	}
	onDestroy(stopRest);

	function fmt(s: number) {
		return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
	}

	const completedCount = $derived(
		exercises.reduce((n, e) => n + e.sets.filter((s) => s.is_completed).length, 0)
	);

	function cancel() {
		if (exercises.length === 0 || confirm('Discard this workout?')) void goto('/');
	}

	async function finish() {
		if (exercises.length === 0) {
			error = 'Add at least one exercise.';
			return;
		}
		saving = true;
		error = '';
		try {
			// Saves locally (works offline) and syncs in the background.
			await logWorkout({
				routine_id: fromRoutineId ?? null,
				title: title || undefined,
				start_time: startTime,
				end_time: Date.now(),
				exercises: exercises.map((ex) => ({
					exercise_id: ex.exercise_id,
					sets: ex.sets.map((s) => ({
						set_type: s.set_type,
						weight: s.weight,
						reps: s.reps,
						is_completed: s.is_completed
					}))
				}))
			});
			await goto('/history');
		} catch (e) {
			error = (e as Error).message;
		} finally {
			saving = false;
		}
	}

	async function prefillFromRoutine(routineId: string) {
		const [r, lib] = await Promise.all([getRoutine(routineId), listExercises()]);
		if (!r) {
			void openPicker();
			return;
		}
		const nameOf = (id: string) => lib.find((e) => e.id === id)?.name ?? 'Exercise';
		fromRoutineId = r.id;
		if (r.title) title = r.title;
		exercises = r.exercises.map((ex) => ({
			uid: crypto.randomUUID(),
			exercise_id: ex.exercise_id,
			name: nameOf(ex.exercise_id),
			sets: ex.sets.map((s) => ({
				uid: crypto.randomUUID(),
				set_type: s.set_type,
				weight: s.target_weight,
				reps: s.target_reps,
				is_completed: false
			}))
		}));
	}

	onMount(() => {
		const routineId = page.url.searchParams.get('routine');
		if (routineId) void prefillFromRoutine(routineId);
		else void openPicker();
	});
</script>

<svelte:head><title>Log workout · Granite</title></svelte:head>

<main class="container" style="padding-bottom: 6rem;">
	<input class="title" placeholder="Workout title (optional)" bind:value={title} />

	{#each exercises as ex (ex.uid)}
		<section class="card ex">
			<div class="ex-head">
				<strong>{ex.name}</strong>
				<button class="link" onclick={() => removeExercise(ex.uid)}>remove</button>
			</div>
			<div class="set-head muted">
				<span>Set</span><span>Type</span><span>Weight</span><span>Reps</span><span>✓</span><span></span>
			</div>
			{#each ex.sets as s, i (s.uid)}
				<div class="set-row" class:done={s.is_completed}>
					<span>{i + 1}</span>
					<select bind:value={s.set_type}>
						{#each setTypes as t}<option value={t}>{t}</option>{/each}
					</select>
					<input type="number" inputmode="decimal" bind:value={s.weight} />
					<input type="number" inputmode="numeric" bind:value={s.reps} />
					<input type="checkbox" checked={s.is_completed} onchange={() => toggleComplete(s)} />
					<button class="link" onclick={() => removeSet(ex, s.uid)}>✕</button>
				</div>
			{/each}
			<button class="btn btn-ghost add-set" onclick={() => addSet(ex)}>+ Add set</button>
		</section>
	{/each}

	{#if pickerOpen}
		<section class="card">
			<div class="ex-head">
				<strong>Add exercise</strong>
				<button class="link" onclick={() => (pickerOpen = false)}>close</button>
			</div>
			{#if !libraryLoaded}
				<p class="muted">Loading…</p>
			{:else}
				<ul class="lib">
					{#each library as l (l.id)}
						<li><button class="lib-item" onclick={() => addExercise(l)}>
							<span>{l.name}</span><span class="muted">{l.primary_muscle}</span>
						</button></li>
					{/each}
				</ul>
			{/if}
		</section>
	{:else}
		<button class="btn btn-ghost" style="width:100%" onclick={openPicker}>+ Add exercise</button>
	{/if}

	{#if error}<p class="error">{error}</p>{/if}
</main>

<div class="footer">
	<div class="container footer-inner">
		<button class="btn btn-ghost" onclick={cancel} data-testid="btn-cancel-workout">Cancel</button>
		{#if restActive}
			<div class="rest">
				<button class="link" onclick={() => bumpRest(-15)}>-15</button>
				<span class="rest-time">⏱ {fmt(restRemaining)}</span>
				<button class="link" onclick={() => bumpRest(15)}>+15</button>
				<button class="link" onclick={stopRest}>skip</button>
			</div>
		{:else}
			<span class="muted">{completedCount} set{completedCount === 1 ? '' : 's'} done</span>
		{/if}
		<button class="btn" onclick={finish} disabled={saving} data-testid="btn-finish-workout"
			>{saving ? 'Saving…' : 'Finish'}</button
		>
	</div>
</div>

<style>
	.title {
		font-size: 1.2rem;
		font-weight: 600;
		margin-bottom: 1rem;
		background: transparent;
		border: none;
		border-bottom: 1px solid var(--border);
		border-radius: 0;
		padding-left: 0;
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
	.set-head,
	.set-row {
		display: grid;
		grid-template-columns: 1.5rem 5rem 1fr 1fr 1.5rem 1.5rem;
		gap: 0.4rem;
		align-items: center;
		font-size: 0.85rem;
	}
	.set-head {
		margin-bottom: 0.3rem;
	}
	.set-row {
		margin-bottom: 0.35rem;
	}
	.set-row.done {
		opacity: 0.7;
	}
	.set-row input[type='number'] {
		padding: 0.4rem;
	}
	select {
		padding: 0.4rem;
		background: var(--surface-2);
		color: var(--text);
		border: 1px solid var(--border);
		border-radius: var(--radius);
	}
	.add-set {
		margin-top: 0.5rem;
		padding: 0.35rem 0.7rem;
		font-size: 0.85rem;
	}
	.link {
		background: none;
		border: none;
		color: var(--accent);
		cursor: pointer;
		font: inherit;
	}
	.lib {
		list-style: none;
		margin: 0;
		padding: 0;
		max-height: 18rem;
		overflow: auto;
	}
	.lib-item {
		width: 100%;
		display: flex;
		justify-content: space-between;
		padding: 0.6rem 0.5rem;
		background: none;
		border: none;
		border-bottom: 1px solid var(--border);
		color: var(--text);
		cursor: pointer;
		text-align: left;
	}
	.footer {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		background: var(--surface);
		border-top: 1px solid var(--border);
	}
	.footer-inner {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding-top: 0.6rem;
		padding-bottom: 0.6rem;
	}
	.rest {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}
	.rest-time {
		font-variant-numeric: tabular-nums;
		font-weight: 600;
	}
</style>
