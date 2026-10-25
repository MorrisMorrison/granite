<script lang="ts">
	import { defaultBar, formatPlates, platesPerSide, plateStep } from '#lib/calc.ts';
	import type { WeightUnit } from '#lib/stores/prefs.svelte.ts';

	// Plates-per-side calculator: a one-side bar diagram, the breakdown, a total stepper
	// and an optional bar override. Used by the Tools page and the logger's plate sheet;
	// `total` binds straight to the caller's weight (a set's weight in the logger).
	let {
		total = $bindable(null),
		bar = $bindable(null),
		unit
	}: { total?: number | null; bar?: number | null; unit: WeightUnit } = $props();

	const barWeight = $derived(bar ?? defaultBar(unit));
	const result = $derived(total != null && total > 0 ? platesPerSide(total, barWeight, unit) : null);
	const step = $derived(plateStep(unit));
	const uid = $props.id();

	// Competition plate colours (real-world, so not theme tokens); bigger plates are taller.
	const LOOK: Record<WeightUnit, Record<string, { h: number; c: string }>> = {
		kg: {
			'25': { h: 100, c: '#dc2626' },
			'20': { h: 100, c: '#2563eb' },
			'15': { h: 88, c: '#eab308' },
			'10': { h: 74, c: '#16a34a' },
			'5': { h: 58, c: '#e5e7eb' },
			'2.5': { h: 46, c: '#dc2626' },
			'1.25': { h: 38, c: '#9ca3af' }
		},
		lb: {
			'45': { h: 100, c: '#2563eb' },
			'35': { h: 92, c: '#eab308' },
			'25': { h: 80, c: '#16a34a' },
			'10': { h: 62, c: '#e5e7eb' },
			'5': { h: 50, c: '#9ca3af' },
			'2.5': { h: 42, c: '#9ca3af' }
		}
	};
	const look = (p: number) => LOOK[unit][String(p)] ?? { h: 50, c: '#9ca3af' };

	function bump(delta: number) {
		total = Math.max(0, Math.round(((total ?? 0) + delta) * 100) / 100);
	}
</script>

<div class="pb">
	{#if result && !result.belowBar}
		<div class="diagram" aria-hidden="true" data-testid="plate-diagram">
			<div class="shaft"></div>
			<div class="collar"></div>
			{#each result.plates as p, i (i)}
				<div class="plate" style={`height:${look(p).h}%;background:${look(p).c}`}>
					<span>{p}</span>
				</div>
			{/each}
			<div class="sleeve"></div>
		</div>
	{/if}

	<p class="result" data-testid="plate-result">
		{#if !result}
			<span class="muted">Enter a weight.</span>
		{:else if result.belowBar}
			Below the bar weight.
		{:else if result.plates.length === 0}
			Just the bar.
		{:else}
			<span class="muted">Each side</span>
			<strong>{formatPlates(result.plates)}</strong>
			{#if result.leftover > 0}<span class="muted">· {result.leftover} {unit} short</span>{/if}
		{/if}
	</p>

	<div class="fields">
		<div class="field">
			<label class="eyebrow" for={`${uid}-total`}>Total ({unit})</label>
			<div class="stepper">
				<button type="button" onclick={() => bump(-step)} aria-label={`Minus ${step} ${unit}`}>−</button>
				<input
					id={`${uid}-total`}
					class="control"
					type="number"
					inputmode="decimal"
					bind:value={total}
					data-testid="field-plate-target"
				/>
				<button type="button" onclick={() => bump(step)} aria-label={`Plus ${step} ${unit}`}>+</button>
			</div>
		</div>
		<div class="field">
			<label class="eyebrow" for={`${uid}-bar`}>Bar</label>
			<input
				id={`${uid}-bar`}
				class="control"
				type="number"
				inputmode="decimal"
				placeholder={String(defaultBar(unit))}
				bind:value={bar}
				data-testid="field-plate-bar"
			/>
		</div>
	</div>
</div>

<style>
	.diagram {
		display: flex;
		align-items: center;
		gap: 3px;
		height: 7rem;
		margin-bottom: 0.75rem;
		padding: 0 0.5rem;
		background: var(--surface-2);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
	}
	.shaft {
		width: 2.5rem;
		height: 0.55rem;
		background: #6b7280;
		border-radius: 2px 0 0 2px;
	}
	.collar {
		width: 0.6rem;
		height: 1.9rem;
		margin-right: 2px;
		background: #9ca3af;
		border-radius: 2px;
	}
	.plate {
		width: 1.35rem;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 3px;
		box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.25);
	}
	.plate span {
		writing-mode: vertical-rl;
		transform: rotate(180deg);
		font-size: 0.68rem;
		font-weight: 700;
		color: rgba(0, 0, 0, 0.75);
	}
	.sleeve {
		flex: 1;
		min-width: 1rem;
		height: 0.8rem;
		background: #9ca3af;
		border-radius: 0 3px 3px 0;
	}
	.result {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.5rem;
		margin: 0 0 0.85rem;
		font-size: 1.05rem;
	}
	.result strong {
		font-size: 1.25rem;
		font-variant-numeric: tabular-nums;
	}
	.fields {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 5rem;
		gap: 0.75rem;
	}
	.fields .eyebrow {
		display: block;
	}
	.stepper {
		display: grid;
		grid-template-columns: 2.75rem minmax(0, 1fr) 2.75rem;
		gap: 0.35rem;
	}
	.stepper button {
		height: 2.75rem;
		padding: 0;
		background: var(--elevated);
		color: var(--text);
		border: none;
		border-radius: var(--radius-md);
		font-size: 1.2rem;
		cursor: pointer;
	}
	.stepper button:hover {
		background: var(--border);
	}
	.stepper input {
		text-align: center;
		padding: 0 0.3rem;
	}
</style>
