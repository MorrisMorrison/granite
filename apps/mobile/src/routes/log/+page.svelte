<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { listExercises, createExercise, type ExerciseInput } from '$lib/repo/exercises';
	import { getRoutine } from '$lib/repo/routines';
	import { logWorkout } from '$lib/repo/workouts';
	import { lastPerformance } from '$lib/repo/stats';
	import { prefs } from '$lib/stores/prefs.svelte';
	import { restAlert } from '$lib/restAlert';
	import { SET_TYPES, setLabel } from '$lib/sets';
	import { roundToLoadable } from '$lib/calc';
	import { displayToKg, kgToDisplay } from '$lib/units';
	import Button from '$lib/components/ui/Button.svelte';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import ExerciseForm from '$lib/components/ExerciseForm.svelte';

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
		notes?: string; // carried from the routine, shown as a cue
		sets: DraftSet[];
		prev?: { weight: number | null; reps: number | null }[]; // last session's sets (kg)
	}

	let title = $state('');
	let notes = $state('');
	let exercises = $state<DraftExercise[]>([]);
	let saving = $state(false);
	let error = $state('');
	let fromRoutineId: string | undefined = $state(undefined);
	const startTime = Date.now();

	const setTypes = SET_TYPES;
	const unit = $derived(prefs.current.weightUnit);

	// --- quick deload (only when started from a routine) ---
	// Knock a % off every prefilled weight at the start of a session. Always applied
	// relative to the routine's original targets (snapshotted once), so re-picking a
	// different % doesn't compound and 0% restores the originals.
	let deloadPct = $state(0);
	let deloadBase: Record<string, number | null> | null = null;
	function applyDeload() {
		if (deloadBase === null) {
			deloadBase = {};
			for (const ex of exercises) for (const s of ex.sets) deloadBase[s.uid] = s.weight;
		}
		const factor = 1 - deloadPct / 100;
		for (const ex of exercises) {
			for (const s of ex.sets) {
				const base = deloadBase[s.uid];
				if (base != null && base > 0) s.weight = roundToLoadable(base * factor, unit);
			}
		}
	}

	// --- exercise picker ---
	let pickerOpen = $state(false);
	let library = $state<{ id: string; name: string; primary_muscle: string }[]>([]);
	let libraryLoaded = $state(false);
	let creating = $state(false);

	async function openPicker() {
		creating = false;
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
		void attachPrev(exercises[exercises.length - 1]);
	}
	// Create a custom exercise mid-picker, then drop it straight into the workout.
	async function createAndAdd(input: ExerciseInput) {
		const id = await createExercise(input);
		const name = input.name.trim();
		library = [...library, { id, name, primary_muscle: input.primary_muscle.trim() }];
		creating = false;
		addExercise({ id, name });
	}

	// Load the exercise's last performance to hint targets (shown as input placeholders).
	async function attachPrev(ex: DraftExercise) {
		const last = await lastPerformance(ex.exercise_id);
		if (last) ex.prev = last.sets;
	}

	function prevWeight(ex: DraftExercise, i: number): string | undefined {
		const p = ex.prev?.[i];
		if (!p || p.weight == null) return undefined;
		const v = kgToDisplay(p.weight, unit);
		return v == null ? undefined : String(v);
	}
	function prevReps(ex: DraftExercise, i: number): string | undefined {
		const p = ex.prev?.[i];
		return p?.reps == null ? undefined : String(p.reps);
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
		if (s.is_completed) startRest(prefs.current.restSeconds);
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
			if (restRemaining <= 0) {
				restAlert(); // buzz + beep when the rest period ends
				stopRest();
			}
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
				notes: notes.trim() || undefined,
				start_time: startTime,
				end_time: Date.now(),
				exercises: exercises.map((ex) => ({
					exercise_id: ex.exercise_id,
					sets: ex.sets.map((s) => ({
						set_type: s.set_type,
						weight: displayToKg(s.weight, unit),
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
			notes: ex.notes,
			sets: ex.sets.map((s) => ({
				uid: crypto.randomUUID(),
				set_type: s.set_type,
				weight: kgToDisplay(s.target_weight, unit),
				reps: s.target_reps,
				is_completed: false
			}))
		}));
		for (const ex of exercises) void attachPrev(ex);
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

	{#if fromRoutineId}
		<label class="deload" data-testid="deload">
			<span>Deload</span>
			<select bind:value={deloadPct} onchange={applyDeload} data-testid="field-deload">
				<option value={0}>None</option>
				<option value={5}>−5%</option>
				<option value={10}>−10%</option>
				<option value={15}>−15%</option>
				<option value={20}>−20%</option>
			</select>
			<span class="muted hint">scales every weight</span>
		</label>
	{/if}

	{#each exercises as ex (ex.uid)}
		<section class="card ex">
			<div class="ex-head">
				<strong>{ex.name}</strong>
				<button class="link" onclick={() => removeExercise(ex.uid)}>remove</button>
			</div>
			{#if ex.notes}<p class="ex-note muted">{ex.notes}</p>{/if}
			<div class="set-head muted">
				<span>Set</span><span>Type</span><span>Weight ({unit})</span><span>Reps</span><span>✓</span><span></span>
			</div>
			{#each ex.sets as s, i (s.uid)}
				<div
					class="set-row"
					class:done={s.is_completed}
					class:warmup={s.set_type === 'warmup'}
					data-testid="set-row"
				>
					<span class="set-no" data-testid="set-label">{s.set_type === 'warmup' ? '' : setLabel(ex.sets, i)}</span>
					<select bind:value={s.set_type} data-testid="set-type">
						{#each setTypes as t}<option value={t}>{t}</option>{/each}
					</select>
					<input
						type="number"
						inputmode="decimal"
						bind:value={s.weight}
						placeholder={prevWeight(ex, i)}
						data-testid="input-weight"
					/>
					<input
						type="number"
						inputmode="numeric"
						bind:value={s.reps}
						placeholder={prevReps(ex, i)}
						data-testid="input-reps"
					/>
					<input
						type="checkbox"
						checked={s.is_completed}
						onchange={() => toggleComplete(s)}
						data-testid="set-complete"
					/>
					<button class="link" onclick={() => removeSet(ex, s.uid)}>✕</button>
				</div>
			{/each}
			<div class="add-set">
				<Button variant="ghost" size="sm" icon="plus" onclick={() => addSet(ex)}>Add set</Button>
			</div>
		</section>
	{/each}

	<Button variant="outline" block icon="plus" onclick={openPicker} testid="btn-add-exercise">
		Add exercise
	</Button>

	{#if exercises.length > 0}
		<textarea
			class="session-notes"
			placeholder="Session notes (how it felt, RPE, aches…)"
			rows="2"
			bind:value={notes}
			data-testid="field-workout-notes"
		></textarea>
	{/if}

	<Sheet
		open={pickerOpen}
		title={creating ? 'New exercise' : 'Add exercise'}
		onclose={() => {
			pickerOpen = false;
			creating = false;
		}}
	>
		{#if creating}
			<button type="button" class="link" onclick={() => (creating = false)}>← Back to list</button>
			<ExerciseForm submitLabel="Create & add" onsubmit={createAndAdd} />
		{:else if !libraryLoaded}
			<p class="muted">Loading…</p>
		{:else}
			<Button
				variant="outline"
				block
				icon="plus"
				onclick={() => (creating = true)}
				testid="btn-picker-new-exercise"
			>
				New exercise
			</Button>
			<ul class="lib">
				{#each library as l (l.id)}
					<li>
						<button class="lib-item" onclick={() => addExercise(l)} data-testid="picker-exercise">
							<span>{l.name}</span><span class="muted">{l.primary_muscle}</span>
						</button>
					</li>
				{/each}
			</ul>
		{/if}
	</Sheet>

	{#if error}<p class="error">{error}</p>{/if}
</main>

<div class="footer">
	<div class="container footer-inner">
		<Button variant="ghost" onclick={cancel} testid="btn-cancel-workout">Cancel</Button>
		{#if restActive}
			<div class="rest">
				<button class="link" onclick={() => bumpRest(-15)}>-15</button>
				<span class="rest-time"><Icon name="clock" size={16} /> {fmt(restRemaining)}</span>
				<button class="link" onclick={() => bumpRest(15)}>+15</button>
				<button class="link" onclick={stopRest}>skip</button>
			</div>
		{:else}
			<span class="muted">{completedCount} set{completedCount === 1 ? '' : 's'} done</span>
		{/if}
		<Button onclick={finish} disabled={saving} testid="btn-finish-workout">
			{saving ? 'Saving…' : 'Finish'}
		</Button>
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
	.deload {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 1rem;
		font-size: 0.85rem;
	}
	.deload .hint {
		font-size: 0.75rem;
	}
	.session-notes {
		width: 100%;
		margin-top: 1rem;
		background: var(--surface-2);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		color: var(--text);
		padding: 0.5rem 0.75rem;
		resize: vertical;
		font-size: 0.9rem;
	}
	.ex {
		margin-bottom: 1rem;
	}
	.ex-note {
		margin: -0.25rem 0 0.6rem;
		font-size: 0.82rem;
		white-space: pre-wrap;
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
		/* Reserve the rail width on every row so warm-up and work sets stay aligned. */
		border-left: 2px solid transparent;
		padding-left: 0.5rem;
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
	.set-no {
		text-align: center;
		color: var(--muted);
		font-variant-numeric: tabular-nums;
	}
	/* Warm-ups read as a de-emphasized ramp leading into the work sets: an accent
	   rail + muted text, no badge. Work sets keep full contrast. */
	.set-row.warmup {
		border-left-color: var(--accent);
		color: var(--muted);
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
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		white-space: nowrap;
		font-variant-numeric: tabular-nums;
		font-weight: 600;
	}
</style>
