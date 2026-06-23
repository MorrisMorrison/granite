<script lang="ts">
	import { prefs } from '$lib/stores/prefs.svelte';
	import { defaultBar, estimate1RM, platesPerSide, repTargets, warmupSets } from '$lib/calc';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';

	const unit = $derived(prefs.current.weightUnit);

	// --- Plates per side ---
	let plateTarget = $state<number | null>(null);
	let plateBar = $state<number | null>(null);
	const barWeight = $derived(plateBar ?? defaultBar(unit));
	const plates = $derived(
		plateTarget != null && plateTarget > 0 ? platesPerSide(plateTarget, barWeight, unit) : null
	);
	function groupPlates(ps: number[]): string {
		const counts = new Map<number, number>();
		for (const p of ps) counts.set(p, (counts.get(p) ?? 0) + 1);
		return [...counts.entries()].map(([w, n]) => `${n}×${w}`).join('   ');
	}

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

	<section class="card calc">
		<h2>Plates per side</h2>
		<div class="row">
			<label
				>Target ({unit})
				<input
					type="number"
					inputmode="decimal"
					bind:value={plateTarget}
					data-testid="field-plate-target"
				/>
			</label>
			<label
				>Bar
				<input
					type="number"
					inputmode="decimal"
					placeholder={String(defaultBar(unit))}
					bind:value={plateBar}
					data-testid="field-plate-bar"
				/>
			</label>
		</div>
		{#if plates}
			<p class="result" data-testid="plate-result">
				{#if plates.belowBar}
					Below the bar weight.
				{:else if plates.plates.length === 0}
					Just the bar.
				{:else}
					<strong>{groupPlates(plates.plates)}</strong> {unit} each side{#if plates.leftover > 0}
						· {plates.leftover} {unit} short{/if}
				{/if}
			</p>
		{/if}
	</section>

	<section class="card calc">
		<h2>Estimated 1RM</h2>
		<div class="row">
			<label
				>Weight ({unit})
				<input
					type="number"
					inputmode="decimal"
					bind:value={rmWeight}
					data-testid="field-1rm-weight"
				/>
			</label>
			<label
				>Reps
				<input type="number" inputmode="numeric" bind:value={rmReps} data-testid="field-1rm-reps" />
			</label>
		</div>
		{#if oneRm > 0}
			<p class="result" data-testid="rm-result"><strong>{oneRm} {unit}</strong> estimated 1RM</p>
			<div class="chips">
				{#each targets as t (t.reps)}<span class="chip">{t.reps}RM ≈ {t.weight}</span>{/each}
			</div>
		{/if}
	</section>

	<section class="card calc">
		<h2>Warm-up sets</h2>
		<label class="single"
			>Working weight ({unit})
			<input
				type="number"
				inputmode="decimal"
				bind:value={warmTarget}
				data-testid="field-warmup-weight"
			/>
		</label>
		{#if warmups.length}
			<ul class="warmups" data-testid="warmup-result">
				{#each warmups as w (w.pct)}
					<li><span class="pct">{Math.round(w.pct * 100)}%</span> <strong>{w.weight} {unit}</strong> × {w.reps}</li>
				{/each}
			</ul>
		{/if}
	</section>
</main>

<style>
	.calc {
		margin-bottom: 1rem;
		padding: 1rem;
	}
	h2 {
		margin: 0 0 0.75rem;
		font-size: 1rem;
		font-weight: 600;
	}
	.row {
		display: flex;
		gap: 0.75rem;
	}
	label {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		font-size: 0.8rem;
		color: var(--muted);
		flex: 1;
	}
	label.single {
		max-width: 12rem;
	}
	input {
		width: 100%;
	}
	.result {
		margin: 0.85rem 0 0;
		font-size: 1.05rem;
	}
	.result strong {
		font-variant-numeric: tabular-nums;
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		margin-top: 0.6rem;
	}
	.chip {
		background: var(--elevated);
		border: 1px solid var(--border);
		border-radius: var(--radius-pill);
		padding: 0.15rem 0.6rem;
		font-size: 0.8rem;
		font-variant-numeric: tabular-nums;
	}
	.warmups {
		list-style: none;
		margin: 0.85rem 0 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}
	.warmups li {
		display: flex;
		align-items: baseline;
		gap: 0.6rem;
		font-variant-numeric: tabular-nums;
	}
	.warmups .pct {
		color: var(--muted);
		width: 2.5rem;
	}
</style>
