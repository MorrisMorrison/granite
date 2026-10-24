<script lang="ts">
	import { untrack } from 'svelte';
	import { setLabel } from '#lib/sets.ts';
	import type { WeightUnit } from '#lib/stores/prefs.svelte.ts';
	import Sheet from '#lib/components/ui/Sheet.svelte';
	import PlateBreakdown from '#lib/components/PlateBreakdown.svelte';

	interface PlateSet {
		uid: string;
		set_type: string;
		weight: number | null;
		is_completed: boolean;
	}

	// Plate calculator for one exercise in the logger. Opens on the next set still to
	// do (the one you're about to load); chips switch sets. The total writes back to
	// that set's weight, so `sets` is bound.
	let {
		open = false,
		title,
		sets = $bindable(),
		unit,
		bar = $bindable(null),
		onclose
	}: {
		open?: boolean;
		title: string;
		sets: PlateSet[];
		unit: WeightUnit;
		bar?: number | null;
		onclose: () => void;
	} = $props();

	let idx = $state(0);

	$effect(() => {
		if (open) {
			const next = untrack(() => sets.findIndex((s) => !s.is_completed));
			idx = next === -1 ? 0 : next;
		}
	});
</script>

<Sheet {open} {title} {onclose}>
	{#if sets[idx]}
		{#if sets.length > 1}
			<div class="chips" role="tablist" aria-label="Sets">
				{#each sets as s, i (s.uid)}
					<button
						class="chip"
						class:on={i === idx}
						class:done={s.is_completed}
						role="tab"
						aria-selected={i === idx}
						onclick={() => (idx = i)}
						data-testid="plate-set-chip"
					>
						<span>{setLabel(sets, i)}</span>
						<strong>{s.weight ?? '–'}</strong>
					</button>
				{/each}
			</div>
		{/if}
		<PlateBreakdown bind:total={sets[idx].weight} bind:bar {unit} />
	{/if}
</Sheet>

<style>
	.chips {
		display: flex;
		gap: 0.4rem;
		overflow-x: auto;
		margin-bottom: 0.75rem;
	}
	.chip {
		display: flex;
		flex-direction: column;
		align-items: center;
		min-width: 3.2rem;
		padding: 0.35rem 0.5rem;
		background: var(--surface-2);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		color: var(--text);
		cursor: pointer;
		font-variant-numeric: tabular-nums;
	}
	.chip span {
		font-size: 0.7rem;
		color: var(--muted);
	}
	.chip.done {
		opacity: 0.55;
	}
	.chip.on {
		border-color: var(--accent);
		box-shadow: 0 0 0 1px var(--accent);
	}
</style>
