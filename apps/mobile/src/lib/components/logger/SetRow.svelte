<script lang="ts">
	import Icon from '#lib/components/ui/Icon.svelte';
	import SetBadge from '#lib/components/ui/SetBadge.svelte';
	import type { DraftSet } from './types.ts';

	// One set in the logger table: type badge · previous · weight · reps · done button.
	let {
		set = $bindable(),
		badge,
		previous = '—',
		weightHint = undefined,
		repsHint = undefined,
		onbadge,
		ontoggle
	}: {
		set: DraftSet;
		badge: string; // 1/2/3…, W, D or F
		previous?: string; // last session's set, e.g. "60 × 5"
		weightHint?: string;
		repsHint?: string;
		onbadge: () => void;
		ontoggle: () => void;
	} = $props();
</script>

<div class="row" class:done={set.is_completed} class:warmup={set.set_type === 'warmup'} data-testid="set-row">
	<SetBadge
		label={badge}
		type={set.set_type}
		onclick={onbadge}
		ariaLabel={`Set ${badge} options`}
		testid="set-label"
	/>
	<span class="prev">{previous}</span>
	<input
		type="number"
		inputmode="decimal"
		aria-label="Weight"
		bind:value={set.weight}
		placeholder={weightHint}
		data-testid="input-weight"
	/>
	<input
		type="number"
		inputmode="numeric"
		aria-label="Reps"
		bind:value={set.reps}
		placeholder={repsHint}
		data-testid="input-reps"
	/>
	<button
		class="check"
		class:on={set.is_completed}
		role="checkbox"
		aria-checked={set.is_completed}
		aria-label={badge === 'W' ? 'Warm-up set done' : `Set ${badge} done`}
		onclick={ontoggle}
		data-testid="set-complete"
	>
		<Icon name="check" size={16} stroke={3} />
	</button>
</div>

<style>
	.row {
		display: grid;
		grid-template-columns: 2rem minmax(0, 1fr) 4.4rem 4.4rem 2rem;
		gap: 0.4rem;
		align-items: center;
		padding: 0.2rem 0.3rem;
		margin: 0 -0.3rem 0.15rem;
		border-radius: var(--radius-md);
	}
	.row.done {
		background: color-mix(in srgb, var(--success) 9%, transparent);
	}
	.prev {
		text-align: center;
		font-size: 0.82rem;
		color: var(--faint);
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	input {
		height: 2.4rem;
		padding: 0 0.2rem;
		text-align: center;
		font-variant-numeric: tabular-nums;
		font-weight: 600;
		background: var(--elevated);
		border: 1px solid transparent;
		border-radius: var(--radius-sm);
		min-width: 0;
	}
	.row.done input {
		background: color-mix(in srgb, var(--text) 5%, transparent);
	}
	input:focus {
		border-color: var(--accent);
	}
	.check {
		width: 2rem;
		height: 2rem;
		padding: 0;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border-radius: 50%;
		border: 1.5px solid var(--border-strong);
		background: transparent;
		color: transparent;
		cursor: pointer;
	}
	.check.on {
		background: var(--success);
		border-color: var(--success);
		color: var(--accent-text);
	}
</style>
