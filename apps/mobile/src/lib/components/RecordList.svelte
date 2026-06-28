<script lang="ts">
	import ListRow from '$lib/components/ui/ListRow.svelte';
	import { kgToDisplay } from '$lib/units';
	import type { WeightUnit } from '$lib/stores/prefs.svelte';

	// A list of e1RM records/PRs. Used for both Recent PRs and the all-time board.
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

<div class="records">
	{#each rows as r (r.exerciseId + r.at)}
		<ListRow
			href={`/exercises/${r.exerciseId}`}
			title={r.exerciseName}
			subtitle={`${disp(r.weight)} ${unit} × ${r.reps} · ${relDate(r.at)}`}
			chevron
			testid={rowTestid}
		>
			{#snippet trailing()}
				<span class="r-1rm">{disp(r.e1rm)} {unit}<small>e1RM</small></span>
			{/snippet}
		</ListRow>
	{/each}
</div>

<style>
	.records {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.r-1rm {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		font-size: 0.9rem;
		line-height: 1.1;
	}
	.r-1rm small {
		font-weight: 400;
		font-size: 0.62rem;
		color: var(--muted);
	}
</style>
