<script lang="ts">
	import { SET_TYPES, SET_TYPE_LABEL, setBadge } from '#lib/sets.ts';
	import { kgToDisplay } from '#lib/units.ts';
	import type { WeightUnit } from '#lib/stores/prefs.svelte.ts';
	import Icon from '#lib/components/ui/Icon.svelte';
	import IconButton from '#lib/components/ui/IconButton.svelte';
	import Sheet from '#lib/components/ui/Sheet.svelte';
	import PlateSheet from '#lib/components/PlateSheet.svelte';
	import SetRow from './SetRow.svelte';
	import type { DraftSet, LoggerExercise } from './types.ts';

	// One exercise in the logger: name + actions menu, set progress, the set table and
	// "Add set". Set-type changes / set deletion live in a sheet opened from the badge.
	let {
		ex = $bindable(),
		unit,
		barbell,
		plateBar = $bindable(null),
		onremove,
		ontoggle,
		onaddset
	}: {
		ex: LoggerExercise;
		unit: WeightUnit;
		barbell: boolean;
		plateBar?: number | null;
		onremove: () => void;
		ontoggle: (s: DraftSet) => void;
		onaddset: () => void;
	} = $props();

	let menuOpen = $state(false);
	let platesOpen = $state(false);
	let setMenuUid = $state<string | null>(null);

	const doneCount = $derived(ex.sets.filter((s) => s.is_completed).length);
	const total = $derived(ex.sets.length);
	const complete = $derived(total > 0 && doneCount === total);
	const menuSet = $derived(ex.sets.find((s) => s.uid === setMenuUid) ?? null);

	const disp = (kg: number | null | undefined) => (kg == null ? null : kgToDisplay(kg, unit));
	function previous(i: number): string {
		const p = ex.prev?.[i];
		if (!p || (p.weight == null && p.reps == null)) return '—';
		return `${disp(p.weight) ?? '—'} × ${p.reps ?? '—'}`;
	}
	function weightHint(i: number): string | undefined {
		const v = disp(ex.prev?.[i]?.weight);
		return v == null ? undefined : String(v);
	}
	function repsHint(i: number): string | undefined {
		const r = ex.prev?.[i]?.reps;
		return r == null ? undefined : String(r);
	}
	function deleteSet(uid: string) {
		ex.sets = ex.sets.filter((s) => s.uid !== uid);
		setMenuUid = null;
	}
</script>

<section class="card ex" data-testid="exercise-card">
	<div class="head">
		<strong class="name">{ex.name}</strong>
		<IconButton
			name="dots-vertical"
			label="Exercise actions"
			size={18}
			onclick={() => (menuOpen = true)}
			testid="btn-ex-menu"
		/>
	</div>

	<div class="progress">
		<span class="pcount">{doneCount}/{total} sets</span>
		<span class="bar">
			<span class="fill" class:complete style={`width:${total ? (doneCount / total) * 100 : 0}%`}></span>
		</span>
	</div>

	{#if ex.notes}<p class="note">{ex.notes}</p>{/if}

	<div class="cols">
		<span>Set</span><span>Previous</span><span>{unit}</span><span>Reps</span><span>✓</span>
	</div>
	{#each ex.sets as s, i (s.uid)}
		<SetRow
			bind:set={ex.sets[i]}
			badge={setBadge(ex.sets, i)}
			previous={previous(i)}
			weightHint={weightHint(i)}
			repsHint={repsHint(i)}
			onbadge={() => (setMenuUid = s.uid)}
			ontoggle={() => ontoggle(s)}
		/>
	{/each}
	<button class="addset" onclick={onaddset}><Icon name="plus" size={14} /> Add set</button>
</section>

<Sheet open={menuOpen} title={ex.name} onclose={() => (menuOpen = false)}>
	<ul class="list">
		{#if barbell}
			<li>
				<button
					class="item"
					data-testid="btn-plates"
					onclick={() => {
						menuOpen = false;
						platesOpen = true;
					}}
				>
					<Icon name="exercises" size={16} /> Plates
				</button>
			</li>
		{/if}
		<li>
			<button
				class="item"
				data-testid="btn-remove-exercise"
				onclick={() => {
					menuOpen = false;
					onremove();
				}}
			>
				<Icon name="trash" size={16} /> Remove exercise
			</button>
		</li>
	</ul>
</Sheet>

{#if barbell}
	<PlateSheet
		open={platesOpen}
		title={`Plates · ${ex.name}`}
		bind:sets={ex.sets}
		{unit}
		bind:bar={plateBar}
		onclose={() => (platesOpen = false)}
	/>
{/if}

<Sheet open={!!menuSet} title="Set type" onclose={() => (setMenuUid = null)}>
	{#if menuSet}
		<ul class="list">
			{#each SET_TYPES as t (t)}
				<li>
					<button
						class="item"
						class:on={menuSet.set_type === t}
						data-testid={`set-type-${t}`}
						onclick={() => {
							if (menuSet) menuSet.set_type = t;
							setMenuUid = null;
						}}
					>
						{SET_TYPE_LABEL[t]}
						{#if menuSet.set_type === t}<span class="tick"><Icon name="check" size={16} /></span>{/if}
					</button>
				</li>
			{/each}
			<li>
				<button class="item" data-testid="btn-delete-set" onclick={() => menuSet && deleteSet(menuSet.uid)}>
					<Icon name="trash" size={16} /> Delete set
				</button>
			</li>
		</ul>
	{/if}
</Sheet>

<style>
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
	.progress {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		margin: 0.15rem 0 0.6rem;
	}
	.pcount {
		font-size: 0.75rem;
		color: var(--muted);
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}
	.bar {
		flex: 1;
		height: 4px;
		border-radius: 2px;
		background: var(--elevated);
		overflow: hidden;
	}
	.fill {
		display: block;
		height: 100%;
		background: var(--accent);
		border-radius: 2px;
		transition: width var(--dur-fast) var(--ease);
	}
	.fill.complete {
		background: var(--success);
	}
	.note {
		margin: 0.2rem 0 0.5rem;
		font-size: 0.82rem;
		color: var(--muted);
		white-space: pre-wrap;
	}
	.cols {
		display: grid;
		grid-template-columns: 2rem minmax(0, 1fr) 4.4rem 4.4rem 2rem;
		gap: 0.4rem;
		margin: 0.5rem 0 0.35rem;
		font-size: 0.65rem;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--faint);
		white-space: nowrap;
		text-align: center;
	}
	.addset {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.35rem;
		width: 100%;
		margin-top: 0.3rem;
		padding: 0.55rem;
		font: inherit;
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--muted);
		background: none;
		border: none;
		border-top: 1px solid var(--border);
		border-radius: 0 0 var(--radius-md) var(--radius-md);
		cursor: pointer;
	}
	.addset:hover {
		color: var(--text);
		background: var(--elevated);
	}
	.list {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.item {
		width: 100%;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem 0.5rem;
		font: inherit;
		text-align: left;
		color: var(--text);
		background: none;
		border: none;
		border-bottom: 1px solid var(--border);
		cursor: pointer;
	}
	.item :global(svg) {
		color: var(--muted);
	}
	.item.on {
		font-weight: 600;
	}
	.tick {
		margin-left: auto;
		display: inline-flex;
	}
	.tick :global(svg) {
		color: var(--accent);
	}
</style>
