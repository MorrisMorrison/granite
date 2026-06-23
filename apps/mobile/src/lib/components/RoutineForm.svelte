<script lang="ts">
	import { onMount } from 'svelte';
	import { listExercises } from '$lib/repo/exercises';
	import { listFolders, type FolderRow } from '$lib/repo/folders';
	import { prefs } from '$lib/stores/prefs.svelte';
	import { displayToKg, kgToDisplay } from '$lib/units';
	import { SET_TYPES, setLabel } from '$lib/sets';
	import { warmupTargetSets } from '$lib/calc';
	import Button from '$lib/components/ui/Button.svelte';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import RestInput from '$lib/components/ui/RestInput.svelte';

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

	const setTypes = SET_TYPES;

	let library = $state<{ id: string; name: string; primary_muscle: string }[]>([]);
	let pickerOpen = $state(false);

	onMount(async () => {
		const [exs, fs] = await Promise.all([listExercises(), listFolders()]);
		library = exs.map((e) => ({ id: e.id, name: e.name, primary_muscle: e.primary_muscle }));
		folders = fs;
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

<input class="rf-title" placeholder="Routine title" bind:value={title} data-testid="field-routine-title" />
<textarea class="rf-notes" placeholder="Notes (optional)" rows="2" bind:value={notes}></textarea>

{#if folders.length > 0}
	<label class="rf-folder">
		Folder
		<select bind:value={folderId} data-testid="field-routine-folder">
			<option value="">No folder</option>
			{#each folders as f (f.id)}<option value={f.id}>{f.name}</option>{/each}
		</select>
	</label>
{/if}

{#each exercises as ex (ex.uid)}
	<section class="card ex">
		<div class="ex-head">
			<strong>{nameFor(ex.exercise_id)}</strong>
			<button class="link" onclick={() => removeExercise(ex.uid)}>remove</button>
		</div>
		<div class="rest">
			<span>Rest</span>
			<RestInput bind:value={ex.rest_seconds} testid="field-rest" />
		</div>
		<input
			class="ex-notes"
			placeholder="Notes (e.g. tempo, cues, setup)"
			bind:value={ex.notes}
			data-testid="field-exercise-notes"
		/>
		<div class="set-head muted">
			<span>Set</span><span>Type</span><span>Target {unit}</span><span>Target reps</span><span></span>
		</div>
		{#each ex.sets as s, i (s.uid)}
			<div class="set-row" class:warmup={s.set_type === 'warmup'} data-testid="rf-set">
				<span class="set-no" data-testid="rf-set-label">{setLabel(ex.sets, i)}</span>
				<select bind:value={s.set_type}>
					{#each setTypes as t}<option value={t}>{t}</option>{/each}
				</select>
				<input
					type="number"
					inputmode="decimal"
					bind:value={s.target_weight}
					data-testid="field-target-weight"
				/>
				<input type="number" inputmode="numeric" bind:value={s.target_reps} />
				<button class="link" onclick={() => removeSet(ex, s.uid)}>✕</button>
			</div>
		{/each}
		<div class="add-set">
			<Button variant="ghost" size="sm" icon="plus" onclick={() => addSet(ex)}>Add set</Button>
			<span title="Adds warm-up sets calculated from this exercise's heaviest set">
				<Button
					variant="ghost"
					size="sm"
					disabled={!canWarmup(ex)}
					onclick={() => addWarmups(ex)}
					testid="btn-warmups">Add warm-ups</Button
				>
			</span>
		</div>
	</section>
{/each}

<Button variant="outline" block icon="plus" onclick={() => (pickerOpen = true)} testid="btn-add-exercise">
	Add exercise
</Button>

<Sheet open={pickerOpen} title="Add exercise" onclose={() => (pickerOpen = false)}>
	<ul class="lib">
		{#each library as l (l.id)}
			<li>
				<button class="lib-item" onclick={() => addExercise(l)} data-testid="picker-exercise">
					<span>{l.name}</span><span class="muted">{l.primary_muscle}</span>
				</button>
			</li>
		{/each}
	</ul>
</Sheet>

{#if error}<p class="error">{error}</p>{/if}

<div class="save">
	<Button block onclick={save} disabled={saving} testid="btn-save-routine">
		{saving ? 'Saving…' : submitLabel}
	</Button>
</div>

<style>
	.rf-title {
		width: 100%;
		font-size: 1.2rem;
		font-weight: 600;
		margin-bottom: 0.5rem;
		background: transparent;
		border: none;
		border-bottom: 1px solid var(--border);
		border-radius: 0;
		padding-left: 0;
	}
	.rf-notes {
		width: 100%;
		background: var(--surface-2);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		color: var(--text);
		padding: 0.5rem 0.75rem;
		margin-bottom: 1rem;
		resize: vertical;
	}
	.rf-folder {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		font-size: 0.85rem;
		color: var(--muted);
		margin-bottom: 1rem;
	}
	.rf-folder select {
		flex: 1;
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
	.rest {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.8rem;
		color: var(--muted);
		margin: 0 0 0.5rem;
	}
	.ex-notes {
		width: 100%;
		margin: 0 0 0.6rem;
		font-size: 0.85rem;
	}
	.set-head,
	.set-row {
		display: grid;
		grid-template-columns: 1.5rem 5rem 1fr 1fr 1.5rem;
		gap: 0.4rem;
		align-items: center;
		font-size: 0.85rem;
		margin-bottom: 0.35rem;
	}
	.set-row input {
		padding: 0.4rem;
	}
	.set-no {
		text-align: center;
		color: var(--muted);
		font-variant-numeric: tabular-nums;
	}
	.set-row.warmup .set-no {
		color: var(--warning);
		font-weight: 600;
	}
	select {
		padding: 0.4rem;
		background: var(--surface-2);
		color: var(--text);
		border: 1px solid var(--border);
		border-radius: var(--radius);
	}
	.add-set {
		margin-top: 0.4rem;
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
	.save {
		margin-top: 1rem;
	}
</style>
