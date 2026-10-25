<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { listExercises, createExercise, type ExerciseInput } from '#lib/repo/exercises.ts';
	import { loadPickerLibrary } from '#lib/repo/exerciseLibrary.ts';
	import { getRoutine } from '#lib/repo/routines.ts';
	import { logWorkout } from '#lib/repo/workouts.ts';
	import { lastPerformance } from '#lib/repo/stats.ts';
	import { prefs } from '#lib/stores/prefs.svelte.ts';
	import { restAlert } from '#lib/restAlert.ts';
	import { cancelRestEnd, keepAwake, scheduleRestEnd } from '#lib/platform/native.ts';
	import { isBarbell, roundDeload } from '#lib/calc.ts';
	import { createRestTimer } from '#lib/restTimer.ts';
	import { displayToKg, kgToDisplay } from '#lib/units.ts';
	import { saveDraft, loadDraft, clearDraft, type WorkoutDraft } from '#lib/workoutDraft.ts';
	import { formatElapsed } from '#lib/duration.ts';
	import Button from '#lib/components/ui/Button.svelte';
	import ExercisePicker from '#lib/components/ExercisePicker.svelte';
	import WorkoutHeader from '#lib/components/logger/WorkoutHeader.svelte';
	import ExerciseCard from '#lib/components/logger/ExerciseCard.svelte';
	import RestPill from '#lib/components/logger/RestPill.svelte';
	import type { DraftSet, LoggerExercise } from '#lib/components/logger/types.ts';

	// LoggerExercise: `notes` is a routine cue, `rest_seconds` the routine's per-exercise rest
	// (drives the timer over the global pref), `prev` last session's sets (kg) as placeholders.

	let title = $state('');
	let notes = $state('');
	let exercises = $state<LoggerExercise[]>([]);
	let saving = $state(false);
	let error = $state('');
	let fromRoutineId: string | undefined = $state(undefined);
	let startTime = $state(Date.now());
	// Set once a draft has been offered/dismissed on mount, so the auto-save $effect
	// doesn't clobber a persisted draft before we've had the chance to restore it.
	let draftReady = $state(false);

	let routineName = $state('');
	// Ticks every second so the elapsed clock in the header stays live.
	let nowTick = $state(Date.now());
	const elapsed = $derived(formatElapsed(nowTick - startTime));
	onMount(() => {
		const id = setInterval(() => (nowTick = Date.now()), 1000);
		return () => clearInterval(id);
	});

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
				if (base != null && base > 0) s.weight = roundDeload(base * factor, unit);
			}
		}
	}

	// --- exercise picker ---
	let pickerOpen = $state(false);
	let library = $state<{ id: string; name: string; primary_muscle: string }[]>([]);
	let libraryLoaded = $state(false);
	// The first load attempt finished (possibly empty) — the picker stops showing "Loading…".
	let libraryTried = $state(false);

	async function openPicker() {
		pickerOpen = true;
		if (!libraryLoaded) {
			library = await loadPickerLibrary();
			// Stay unloaded while empty (fresh account, nothing pulled yet) so the next open retries.
			libraryLoaded = library.length > 0;
			libraryTried = true;
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
		if (isBarbell(input.equipment)) barbellIds = new Set([...barbellIds, id]);
		const name = input.name.trim();
		library = [...library, { id, name, primary_muscle: input.primary_muscle.trim() }];
		addExercise({ id, name });
	}

	// --- plate calculator (barbell exercises only, on demand; the sheet lives in ExerciseCard) ---
	let barbellIds = $state(new Set<string>());
	let plateBar = $state<number | null>(null); // bar override, kept for the session
	onMount(async () => {
		const all = await listExercises();
		barbellIds = new Set(all.filter((e) => isBarbell(e.equipment)).map((e) => e.id));
	});

	// Load the exercise's last performance to hint targets (shown as input placeholders).
	async function attachPrev(ex: LoggerExercise) {
		const last = await lastPerformance(ex.exercise_id);
		if (last) ex.prev = last.sets;
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

	function addSet(ex: LoggerExercise) {
		ex.sets.push(blankSet(ex.sets[ex.sets.length - 1]));
	}
	function removeExercise(uid: string) {
		exercises = exercises.filter((e) => e.uid !== uid);
	}

	function toggleComplete(ex: LoggerExercise, s: DraftSet) {
		s.is_completed = !s.is_completed;
		// Prefer the routine exercise's own rest; fall back to the global default.
		if (s.is_completed) startRest(ex.rest_seconds && ex.rest_seconds > 0 ? ex.rest_seconds : prefs.current.restSeconds);
	}

	// --- rest timer (wall-clock: tracks an absolute end time, so it stays accurate
	// while the phone is locked/backgrounded — see restTimer.ts) ---
	const timer = createRestTimer();
	let restRemaining = $state(0);
	let restActive = $state(false);
	let restInterval: ReturnType<typeof setInterval> | null = null;

	// Mirror the timer's state into the reactive vars the UI reads.
	function sync() {
		restRemaining = timer.remaining();
		restActive = timer.active();
	}
	// Recompute against the wall clock; fire the alert on the expiry transition.
	// True while a native notification is scheduled for the running rest: it alerts
	// the user itself, so the in-app buzz + beep would be a second alert.
	let nativeAlert = false;
	// A skipped/restarted rest's late result must not decide the next rest's alert.
	let restGen = 0;
	function refresh() {
		if (timer.tick(Date.now())) {
			if (!nativeAlert) restAlert(); // buzz + beep when the rest period ends
			// Rest is over: clear the native notification (delivered or still pending, e.g. inexact) either way.
			void cancelRestEnd();
			nativeAlert = false;
		}
		sync();
		if (!timer.active() && restInterval) {
			clearInterval(restInterval);
			restInterval = null;
		}
	}

	function startRest(seconds: number) {
		restGen++;
		timer.start(seconds);
		if (!restInterval) restInterval = setInterval(refresh, 1000);
		sync();
		const gen = restGen;
		void scheduleRestEnd(timer.endsAt()!).then((ok) => {
			if (gen === restGen) nativeAlert = ok;
		});
	}
	function bumpRest(delta: number) {
		timer.bump(delta);
		sync();
		const at = timer.endsAt();
		const gen = restGen;
		if (at)
			void scheduleRestEnd(at).then((ok) => {
				if (gen === restGen) nativeAlert = ok;
			});
	}
	function stopRest() {
		restGen++;
		timer.stop();
		if (restInterval) {
			clearInterval(restInterval);
			restInterval = null;
		}
		sync();
		nativeAlert = false;
		void cancelRestEnd();
	}

	// On resume (unlock/foreground) recompute immediately so a rest that elapsed
	// while backgrounded expires at once instead of waiting for the next tick.
	function onVisible() {
		if (document.visibilityState === 'visible') refresh();
	}
	onMount(() => {
		document.addEventListener('visibilitychange', onVisible);
		void keepAwake(true);
	});
	onDestroy(() => {
		document.removeEventListener('visibilitychange', onVisible);
		stopRest();
		void keepAwake(false);
	});

	const completedCount = $derived(
		exercises.reduce((n, e) => n + e.sets.filter((s) => s.is_completed).length, 0)
	);

	function cancel() {
		if (exercises.length === 0 || confirm('Discard this workout?')) {
			clearDraft();
			void goto('/');
		}
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
			clearDraft(); // the workout is saved; drop the in-progress draft
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
		routineName = r.title;
		if (r.title) title = r.title;
		exercises = r.exercises.map((ex) => ({
			uid: crypto.randomUUID(),
			exercise_id: ex.exercise_id,
			name: nameOf(ex.exercise_id),
			notes: ex.notes,
			rest_seconds: ex.rest_seconds,
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

	// Restore a persisted draft into the reactive state, then re-fetch last-session hints.
	function restoreDraft(d: WorkoutDraft) {
		title = d.title;
		notes = d.notes;
		startTime = d.startTime;
		fromRoutineId = d.fromRoutineId;
		if (d.fromRoutineId) void getRoutine(d.fromRoutineId).then((r) => (routineName = r?.title ?? ''));
		exercises = d.exercises;
		for (const ex of exercises) void attachPrev(ex);
	}

	onMount(() => {
		const draft = loadDraft();
		if (draft && confirm('You have an unfinished workout. Resume it?')) {
			restoreDraft(draft);
			draftReady = true;
			return;
		}
		if (draft) clearDraft(); // declined — start fresh
		const routineId = page.url.searchParams.get('routine');
		if (routineId) void prefillFromRoutine(routineId).finally(() => (draftReady = true));
		else {
			void openPicker();
			draftReady = true;
		}
	});

	// Auto-persist the in-progress workout on any meaningful change, so a back-swipe,
	// tab eviction, or reload doesn't discard it. Cheap: just serializes the state.
	// Gated on draftReady so it can't overwrite a stored draft before restore runs.
	$effect(() => {
		if (!draftReady) return;
		saveDraft({
			title,
			notes,
			startTime,
			fromRoutineId,
			exercises: exercises.map((ex) => ({
				uid: ex.uid,
				exercise_id: ex.exercise_id,
				name: ex.name,
				notes: ex.notes,
				rest_seconds: ex.rest_seconds,
				sets: ex.sets.map((s) => ({
					uid: s.uid,
					set_type: s.set_type,
					weight: s.weight,
					reps: s.reps,
					is_completed: s.is_completed
				}))
			}))
		});
	});
</script>

<svelte:head><title>Log workout · Granite</title></svelte:head>

<main class="container" style="padding-bottom: 9rem;">
	<WorkoutHeader
		{elapsed}
		{routineName}
		bind:title
		showDeload={!!fromRoutineId}
		{deloadPct}
		ondeload={(p) => {
			deloadPct = p;
			applyDeload();
		}}
	/>

	{#each exercises as ex, i (ex.uid)}
		<ExerciseCard
			bind:ex={exercises[i]}
			{unit}
			barbell={barbellIds.has(ex.exercise_id)}
			bind:plateBar
			onremove={() => removeExercise(ex.uid)}
			ontoggle={(s) => toggleComplete(ex, s)}
			onaddset={() => addSet(ex)}
		/>
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

	<ExercisePicker
		open={pickerOpen}
		library={libraryTried ? library : null}
		onpick={addExercise}
		oncreate={createAndAdd}
		onclose={() => (pickerOpen = false)}
	/>

	{#if error}<p class="error">{error}</p>{/if}
</main>

<div class="footer">
	<div class="container footer-inner">
		{#if restActive}
			<RestPill remaining={restRemaining} onbump={bumpRest} onskip={stopRest} />
		{/if}
		<div class="footer-row">
			<Button variant="ghost" size="sm" onclick={cancel} testid="btn-cancel-workout">Cancel</Button>
			<span class="count">{completedCount} set{completedCount === 1 ? '' : 's'} done</span>
			<Button size="sm" onclick={finish} disabled={saving} testid="btn-finish-workout">
				{saving ? 'Saving…' : 'Finish'}
			</Button>
		</div>
	</div>
</div>

<style>
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
		flex-direction: column;
		gap: 0.5rem;
		/* Tighter side padding than the page container so the bar fits on small phones. */
		padding: 0.6rem 0.75rem;
	}
	.footer-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}
	.count {
		font-size: 0.8rem;
		color: var(--faint);
	}
</style>
