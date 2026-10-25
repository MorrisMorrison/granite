<script lang="ts">
	import { prefs } from '#lib/stores/prefs.svelte.ts';
	import { estimate1RM, repTargets, warmupSets } from '#lib/calc.ts';
	import PageHeader from '#lib/components/ui/PageHeader.svelte';
	import PlateBreakdown from '#lib/components/PlateBreakdown.svelte';
	import SetBadge from '#lib/components/ui/SetBadge.svelte';

	const unit = $derived(prefs.current.weightUnit);

	// --- Estimated 1RM ---
	let rmWeight = $state<number | null>(null);
	let rmReps = $state<number | null>(null);
	const oneRm = $derived(rmWeight != null && rmReps != null ? estimate1RM(rmWeight, rmReps) : 0);
	const targets = $derived(oneRm > 0 ? repTargets(oneRm) : []);

	// --- Warm-up sets ---
	let warmTarget = $state<number | null>(null);
	const warmups = $derived(warmTarget != null && warmTarget > 0 ? warmupSets(warmTarget, unit) : []);
</script>

<svelte:head><title>Calculators · Granite</title></svelte:head>

<main class="container">
	<PageHeader title="Calculators" />

	<section class="card calc" aria-label="Plates per side">
		<p class="eyebrow title">Plates per side</p>
		<PlateBreakdown {unit} />
	</section>

	<section class="card calc" aria-label="Estimated 1RM">
		<p class="eyebrow title">Estimated 1RM</p>
		<div class="pair">
			<label class="field">
				<span class="eyebrow">Weight ({unit})</span>
				<input
					class="control"
					type="number"
					inputmode="decimal"
					bind:value={rmWeight}
					data-testid="field-1rm-weight"
				/>
			</label>
			<label class="field">
				<span class="eyebrow">Reps</span>
				<input
					class="control"
					type="number"
					inputmode="numeric"
					bind:value={rmReps}
					data-testid="field-1rm-reps"
				/>
			</label>
		</div>
		{#if oneRm > 0}
			<p class="result" data-testid="rm-result">
				<span class="big-num">{oneRm} {unit}</span>
				<span class="muted">estimated 1RM</span>
			</p>
			<div class="chips">
				{#each targets as t (t.reps)}<span class="chip">{t.reps}RM ≈ {t.weight}</span>{/each}
			</div>
		{/if}
	</section>

	<section class="card calc" aria-label="Warm-up sets">
		<p class="eyebrow title">Warm-up sets</p>
		<label class="field single">
			<span class="eyebrow">Working weight ({unit})</span>
			<input
				class="control"
				type="number"
				inputmode="decimal"
				bind:value={warmTarget}
				data-testid="field-warmup-weight"
			/>
		</label>
		{#if warmups.length}
			<ul class="group warmups" data-testid="warmup-result">
				{#each warmups as w (w.pct)}
					<li class="group-row warm">
						<SetBadge label="W" type="warmup" />
						<span class="group-row-body">
							<span class="set">{w.weight} {unit} × {w.reps}</span>
						</span>
						<span class="pct">{Math.round(w.pct * 100)}%</span>
					</li>
				{/each}
			</ul>
		{/if}
	</section>
</main>

<style>
	.calc {
		margin-bottom: 0.9rem;
	}
	.title {
		margin-bottom: 0.75rem;
	}
	.pair {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.75rem;
	}
	.single {
		max-width: 14rem;
	}
	.result {
		display: flex;
		align-items: baseline;
		flex-wrap: wrap;
		gap: 0.2rem 0.5rem;
		margin: 1rem 0 0;
	}
	.result .muted {
		font-size: 0.85rem;
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		margin-top: 0.6rem;
	}
	.chip {
		background: var(--elevated);
		border-radius: var(--radius-pill);
		padding: 0.15rem 0.6rem;
		font-size: 0.8rem;
		color: var(--muted);
		font-variant-numeric: tabular-nums;
	}
	.warmups {
		list-style: none;
		margin: 1rem 0 0;
		padding: 0;
		background: var(--bg);
	}
	.warm {
		padding: 0.45rem 0.9rem 0.45rem 0.6rem;
	}
	.set {
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}
	.pct {
		font-size: 0.8rem;
		color: var(--faint);
		font-variant-numeric: tabular-nums;
	}
</style>
