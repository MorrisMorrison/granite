<script lang="ts">
	import Icon from '#lib/components/ui/Icon.svelte';
	import { kgToDisplay } from '#lib/units.ts';
	import type { WeightUnit } from '#lib/stores/prefs.svelte.ts';

	// A list of e1RM records/PRs as one grouped card. Used for both Recent PRs and the
	// all-time board.
	interface Row {
		exerciseId: string;
		exerciseName: string;
		weight: number; // kg
		reps: number;
		e1rm: number; // kg, rounded
		at: number; // epoch ms
	}
	let {
		rows,
		unit,
		rowTestid = 'record-row'
	}: { rows: Row[]; unit: WeightUnit; rowTestid?: string } = $props();

	const disp = (kg: number) => Math.round(kgToDisplay(kg, unit) ?? 0);
	function relDate(ts: number): string {
		const days = Math.floor((Date.now() - ts) / 86400000);
		if (days <= 0) return 'today';
		if (days === 1) return 'yesterday';
		if (days < 7) return `${days}d ago`;
		if (days < 28) return `${Math.floor(days / 7)}w ago`;
		return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
	}
</script>

<div class="group records">
	{#each rows as r, i (`${r.exerciseId}-${r.at}-${i}`)}
		<a class="group-row" href={`/exercises/${r.exerciseId}`} data-testid={rowTestid}>
			<span class="group-row-body">
				<span class="group-row-title">{r.exerciseName}</span>
				<span class="group-row-sub">{`${disp(r.weight)} ${unit} × ${r.reps} · ${relDate(r.at)}`}</span>
			</span>
			<span class="r-1rm">{disp(r.e1rm)} {unit}<small>e1RM</small></span>
			<span class="group-row-chev chev"><Icon name="chevron-right" size={18} /></span>
		</a>
	{/each}
</div>

<style>
	.r-1rm {
		flex-shrink: 0;
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		font-weight: 650;
		font-variant-numeric: tabular-nums;
		font-size: 0.92rem;
		line-height: 1.15;
	}
	.r-1rm small {
		font-weight: 500;
		font-size: 0.62rem;
		letter-spacing: 0.04em;
		color: var(--faint);
	}
	.chev {
		margin-left: -0.35rem;
	}
</style>
