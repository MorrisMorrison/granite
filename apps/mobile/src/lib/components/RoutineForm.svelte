<script lang="ts">
	import { onMount } from 'svelte';
	import { createExercise, type ExerciseInput } from '#lib/repo/exercises.ts';
	import { loadPickerLibrary } from '#lib/repo/exerciseLibrary.ts';
	import { listFolders, type FolderRow } from '#lib/repo/folders.ts';
	import { prefs } from '#lib/stores/prefs.svelte.ts';
	import { displayToKg, kgToDisplay } from '#lib/units.ts';
	import { setBadge } from '#lib/sets.ts';
	import { warmupTargetSets } from '#lib/calc.ts';
	import Button from '#lib/components/ui/Button.svelte';
	import Icon from '#lib/components/ui/Icon.svelte';
	import IconButton from '#lib/components/ui/IconButton.svelte';
	import SetBadge from '#lib/components/ui/SetBadge.svelte';
	import Sheet from '#lib/components/ui/Sheet.svelte';
	import ExercisePicker from '#lib/components/ExercisePicker.svelte';
	import SetTypeSheet from '#lib/components/SetTypeSheet.svelte';
	import RestInput from '#lib/components/ui/RestInput.svelte';

	interface DraftSet {
		uid: string;
		set_type: string;
		target_weight: number | null;
		target_reps: number | null;
	}
	interface DraftExercise {
		uid: string;
		exercise_id: string;
		rest_seconds: number;
		notes: string;
		sets: DraftSet[];
	}
	interface InitialExercise {
		exercise_id: string;
		rest_seconds: number;
		notes?: string;
		sets: { set_type: string; target_weight: number | null; target_reps: number | null }[];
	}

	interface Payload {
		title: string;
		notes: string;
		folder_id: string | null;
		exercises: {
			exercise_id: string;
			rest_seconds: number;
			notes: string;
			sets: { set_type: string; target_weight?: number; target_reps?: number }[];
		}[];
	}

	let {
		initialTitle = '',
		initialNotes = '',
		initialFolderId = null,
		initialExercises = [],
		submitLabel = 'Save',
		onsubmit
	}: {
		initialTitle?: string;
		initialNotes?: string;
		initialFolderId?: string | null;
		initialExercises?: InitialExercise[];
		submitLabel?: string;
		onsubmit: (payload: Payload) => Promise<void>;
	} = $props();

	let title = $state(initialTitle);
	let notes = $state(initialNotes);
	let folderId = $state(initialFolderId ?? '');
	let folders = $state<FolderRow[]>([]);
	const unit = $derived(prefs.current.weightUnit);
	// Drafts hold weights in the user's display unit; stored targets are kg.
	let exercises = $state<DraftExercise[]>(
		initialExercises.map((e) => ({
			uid: crypto.randomUUID(),
			exercise_id: e.exercise_id,
			rest_seconds: e.rest_seconds,
			notes: e.notes ?? '',
			sets: e.sets.map((s) => ({
				uid: crypto.randomUUID(),
				set_type: s.set_type,
				target_weight: kgToDisplay(s.target_weight, prefs.current.weightUnit),
				target_reps: s.target_reps
			}))
		}))
	);
	let saving = $state(false);
	let error = $state('');

	// Open sheets: the exercise actions menu, and the set-type sheet behind a set badge.
	let menuUid = $state<string | null>(null);
	let setMenu = $state<{ ex: string; set: string } | null>(null);
	const menuEx = $derived(exercises.find((e) => e.uid === menuUid) ?? null);
	const menuSetEx = $derived(setMenu ? (exercises.find((e) => e.uid === setMenu?.ex) ?? null) : null);
	const menuSet = $derived(menuSetEx?.sets.find((s) => s.uid === setMenu?.set) ?? null);

	let library = $state<{ id: string; name: string; primary_muscle: string }[]>([]);
	let pickerOpen = $state(false);

	onMount(async () => {
		[library, folders] = await Promise.all([loadPickerLibrary(), listFolders()]);
	});

	function nameFor(id: string): string {
		return library.find((l) => l.id === id)?.name ?? 'Exercise';
	}

	function blankSet(from?: DraftSet): DraftSet {
		return {
			uid: crypto.randomUUID(),
			set_type: 'normal',
			target_weight: from?.target_weight ?? null,
			target_reps: from?.target_reps ?? null
		};
	}
	function addExercise(ex: { id: string }) {
		exercises.push({
			uid: crypto.randomUUID(),
			exercise_id: ex.id,
			rest_seconds: 90,
			notes: '',
			sets: [blankSet()]
		});
		pickerOpen = false;
	}
	// Create a custom exercise mid-picker, then drop it straight into the routine.
	async function createAndAdd(input: ExerciseInput) {
		const id = await createExercise(input);
		library = [...library, { id, name: input.name.trim(), primary_muscle: input.primary_muscle.trim() }];
		addExercise({ id });
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

	// True once the exercise has a work set with a weight to base warm-ups on.
	function canWarmup(ex: DraftExercise): boolean {
		return ex.sets.some((s) => s.set_type !== 'warmup' && (s.target_weight ?? 0) > 0);
	}
	// Replace this exercise's warm-up sets with a fresh ramp from its heaviest work set.
	function addWarmups(ex: DraftExercise) {
		const warm = warmupTargetSets(ex.sets, unit);
		if (warm.length === 0) return;
		const work = ex.sets.filter((s) => s.set_type !== 'warmup');
		ex.sets = [
			...warm.map((w) => ({
				uid: crypto.randomUUID(),
				set_type: w.set_type,
				target_weight: w.target_weight,
				target_reps: w.target_reps
			})),
			...work
		];
	}

	async function save() {
		if (!title.trim()) {
			error = 'A title is required.';
			return;
		}
		saving = true;
		error = '';
		try {
			await onsubmit({
				title: title.trim(),
				notes,
				folder_id: folderId || null,
				exercises: exercises.map((ex) => ({
					exercise_id: ex.exercise_id,
					rest_seconds: ex.rest_seconds ?? 0,
					notes: ex.notes.trim(),
					sets: ex.sets.map((s) => ({
						set_type: s.set_type,
						target_weight: displayToKg(s.target_weight, unit) ?? undefined,
						target_reps: s.target_reps ?? undefined
					}))
				}))
			});
		} catch (e) {
			error = (e as Error).message;
		} finally {
			saving = false;
		}
	}
</script>

<input
	class="rf-title"
	placeholder="Routine title"
	aria-label="Routine title"
	bind:value={title}
	data-testid="field-routine-title"
/>

<div class="form rf-meta">
	<label class="field">
		<span class="eyebrow">Notes <span class="field-opt">(optional)</span></span>
		<textarea class="control" rows="2" bind:value={notes} data-testid="field-routine-notes"></textarea>
	</label>
	{#if folders.length > 0}
		<label class="field">
			<span class="eyebrow">Folder</span>
			<select class="control" bind:value={folderId} data-testid="field-routine-folder">
				<option value="">No folder</option>
				{#each folders as f (f.id)}<option value={f.id}>{f.name}</option>{/each}
			</select>
		</label>
	{/if}
</div>

{#each exercises as ex (ex.uid)}
	<section class="card ex" data-testid="rf-exercise">
		<div class="head">
			<strong class="name">{nameFor(ex.exercise_id)}</strong>
			<IconButton
				name="dots-vertical"
				label="Exercise actions"
				size={18}
				onclick={() => (menuUid = ex.uid)}
				testid="btn-ex-menu"
			/>
		</div>
		<div class="rest">
			<span class="eyebrow">Rest</span>
			<RestInput bind:value={ex.rest_seconds} testid="field-rest" />
		</div>
		<input
			class="control ex-notes"
			placeholder="Notes (e.g. tempo, cues, setup)"
			aria-label="Exercise notes"
			bind:value={ex.notes}
			data-testid="field-exercise-notes"
		/>
		<div class="cols table-head" aria-hidden="true">
			<span>Set</span><span>{unit}</span><span>Reps</span>
		</div>
		{#each ex.sets as s, i (s.uid)}
			{@const badge = setBadge(ex.sets, i)}
			<div class="set-row" class:warmup={s.set_type === 'warmup'} data-testid="rf-set">
				<SetBadge
					label={badge}
					type={s.set_type}
					onclick={() => (setMenu = { ex: ex.uid, set: s.uid })}
					ariaLabel={`Set ${badge} options`}
					testid="rf-set-label"
				/>
				<input
					class="set-input"
					type="number"
					inputmode="decimal"
					aria-label="Target weight"
					bind:value={s.target_weight}
					data-testid="field-target-weight"
				/>
				<input
					class="set-input"
					type="number"
					inputmode="numeric"
					aria-label="Target reps"
					bind:value={s.target_reps}
					data-testid="field-target-reps"
				/>
			</div>
		{/each}
		<button class="add-row" onclick={() => addSet(ex)} data-testid="btn-add-set">
			<Icon name="plus" size={14} /> Add set
		</button>
	</section>
{/each}

<Button
	variant="outline"
	block
	icon="plus"
	onclick={() => (pickerOpen = true)}
	testid="btn-add-exercise"
>
	Add exercise
</Button>

<ExercisePicker
	open={pickerOpen}
	{library}
	onpick={addExercise}
	oncreate={createAndAdd}
	onclose={() => (pickerOpen = false)}
/>

<Sheet open={!!menuEx} title={menuEx ? nameFor(menuEx.exercise_id) : ''} onclose={() => (menuUid = null)}>
	{#if menuEx}
		{@const ex = menuEx}
		<ul class="menu">
			<li>
				<button
					class="menu-item"
					disabled={!canWarmup(ex)}
					data-testid="btn-warmups"
					onclick={() => {
						addWarmups(ex);
						menuUid = null;
					}}
				>
					<Icon name="plus" size={16} /> Add warm-ups
					{#if !canWarmup(ex)}<span class="menu-hint">Needs a work weight</span>{/if}
				</button>
			</li>
			<li>
				<button
					class="menu-item danger"
					data-testid="btn-remove-exercise"
					onclick={() => {
						removeExercise(ex.uid);
						menuUid = null;
					}}
				>
					<Icon name="trash" size={16} /> Remove exercise
				</button>
			</li>
		</ul>
	{/if}
</Sheet>

<SetTypeSheet
	open={!!menuSet}
	type={menuSet?.set_type}
	onpick={(t) => {
		if (menuSet) menuSet.set_type = t;
		setMenu = null;
	}}
	ondelete={() => {
		if (menuSetEx && menuSet) removeSet(menuSetEx, menuSet.uid);
		setMenu = null;
	}}
	onclose={() => (setMenu = null)}
/>

{#if error}<p class="error">{error}</p>{/if}

<div class="save">
	<Button block onclick={save} disabled={saving} testid="btn-save-routine">
		{saving ? 'Saving…' : submitLabel}
	</Button>
</div>

<style>
	/* The routine's name is the screen's heading, like the logger's workout title. */
	.rf-title {
		margin: 0.15rem 0 0;
		padding: 0.2rem 0;
		font-size: 1.6rem;
		font-weight: 650;
		letter-spacing: -0.02em;
		background: transparent;
		border: 1px solid transparent;
		border-radius: var(--radius-sm);
	}
	.rf-title:focus {
		padding: 0.2rem 0.5rem;
		background: var(--elevated);
		border-color: var(--accent);
	}
	.rf-meta {
		margin: 0.75rem 0 1.25rem;
	}
	.ex {
		margin-bottom: 0.9rem;
		padding: 0.85rem 0.9rem 0.6rem;
	}
	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}
	.name {
		min-width: 0;
		font-weight: 650;
		letter-spacing: -0.01em;
		font-size: 1.02rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.rest {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		margin: 0.2rem 0 0.5rem;
	}
	.ex-notes {
		height: 2.4rem;
		font-size: 0.85rem;
	}
	.cols,
	.set-row {
		display: grid;
		grid-template-columns: 2rem minmax(0, 1fr) minmax(0, 1fr);
		gap: 0.4rem;
		align-items: center;
	}
	.cols {
		margin: 0.75rem 0 0.35rem;
	}
	.set-row {
		margin-bottom: 0.25rem;
	}
	.save {
		margin-top: 1rem;
	}
</style>
