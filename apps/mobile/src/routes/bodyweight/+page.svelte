<script lang="ts">
	import { onMount } from 'svelte';
	import {
		listBodyweight,
		addBodyweight,
		deleteBodyweight,
		type BodyweightEntry
	} from '#lib/repo/bodyweight.ts';
	import { syncNow } from '#lib/sync/index.ts';
	import { prefs } from '#lib/stores/prefs.svelte.ts';
	import { displayToKg, kgToDisplay } from '#lib/units.ts';
	import BackLink from '#lib/components/ui/BackLink.svelte';
	import PageHeader from '#lib/components/ui/PageHeader.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import LineChart from '#lib/components/ui/LineChart.svelte';
	import IconButton from '#lib/components/ui/IconButton.svelte';
	import EmptyState from '#lib/components/ui/EmptyState.svelte';

	let entries = $state<BodyweightEntry[]>([]);
	let loading = $state(true);
	let input = $state<number | null>(null);
	let saving = $state(false);

	const unit = $derived(prefs.current.weightUnit);
	// Oldest → newest, in the display unit, for the chart.
	const chartValues = $derived(
		[...entries].reverse().map((e) => kgToDisplay(e.weight, unit) ?? 0)
	);

	// Header: the latest weigh-in (entries are newest first), and the change across the chart.
	const eyebrow = $derived(
		entries.length ? `Latest · ${w(entries[0].weight)} ${unit}` : 'Track your weight'
	);
	const change = $derived.by(() => {
		if (chartValues.length < 2) return null;
		const d = Math.round((chartValues[chartValues.length - 1] - chartValues[0]) * 10) / 10;
		const since = fmtShort(entries[entries.length - 1].recorded_at);
		return `${d > 0 ? '+' : d < 0 ? '−' : '±'}${Math.abs(d)} ${unit} since ${since}`;
	});

	async function load() {
		entries = await listBodyweight();
	}
	onMount(async () => {
		await load();
		loading = false;
		try {
			await syncNow();
			await load();
		} catch {
			/* offline — keep local */
		}
	});

	async function logWeight() {
		const kg = displayToKg(input, unit);
		if (kg == null || kg <= 0) return;
		saving = true;
		await addBodyweight(kg);
		input = null;
		await load();
		saving = false;
	}
	async function remove(id: string) {
		if (!confirm('Delete this weigh-in?')) return;
		await deleteBodyweight(id);
		await load();
	}
	function fmtDate(ms: number): string {
		return new Date(ms).toLocaleDateString(undefined, {
			weekday: 'short',
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	}
	function fmtShort(ms: number): string {
		return new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
	}
	function w(kg: number): string {
		const v = kgToDisplay(kg, unit);
		return v == null ? '—' : String(v);
	}
</script>

<svelte:head><title>Bodyweight · Granite</title></svelte:head>

<main class="container">
	<BackLink href="/" label="Today" />
	<PageHeader title="Bodyweight" eyebrow={loading ? undefined : eyebrow} />

	<section class="card log" aria-label="Log a weigh-in">
		<label class="field" for="bw-input"><span class="eyebrow">Log weight</span></label>
		<div class="add">
			<input
				id="bw-input"
				class="control"
				type="number"
				inputmode="decimal"
				step="0.1"
				placeholder={`Weight (${unit})`}
				bind:value={input}
				data-testid="field-bodyweight"
			/>
			<Button onclick={logWeight} disabled={saving || !input} testid="btn-log-bodyweight">Log</Button>
		</div>
	</section>

	{#if loading}
		<p class="muted">Loading…</p>
	{:else if entries.length === 0}
		<EmptyState
			icon="history"
			title="No weigh-ins yet"
			description="Log your bodyweight to track it over time."
		/>
	{:else}
		{#if chartValues.length >= 2}
			<section class="card chart-card" data-testid="bw-trend">
				<div class="chart-head">
					<p class="eyebrow">Trend</p>
					{#if change}<span class="change">{change}</span>{/if}
				</div>
				<div class="chart"><LineChart values={chartValues} label="Bodyweight over time" /></div>
			</section>
		{/if}
		<h2 class="eyebrow label">Entries</h2>
		<div class="group">
			{#each entries as e (e.id)}
				<div class="group-row row" data-testid="bw-row">
					<span class="group-row-body">
						<span class="date">{fmtDate(e.recorded_at)}</span>
					</span>
					<span class="group-row-val">{w(e.weight)} {unit}</span>
					<IconButton
						name="trash"
						label="Delete weigh-in"
						size={16}
						onclick={() => remove(e.id)}
						testid="btn-delete-bodyweight"
					/>
				</div>
			{/each}
		</div>
	{/if}
</main>

<style>
	.log {
		margin-bottom: 0.9rem;
	}
	.log .field {
		margin-bottom: 0.4rem;
	}
	.add {
		display: flex;
		gap: 0.5rem;
	}
	.add input {
		flex: 1;
		min-width: 0;
	}
	/* Stretch the field to the Log button's height so the pair lines up. */
	.add input {
		height: auto;
	}
	.chart-card {
		margin-bottom: 0.9rem;
	}
	.chart-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.5rem;
		margin-bottom: 0.4rem;
	}
	.change {
		font-size: 0.8rem;
		color: var(--muted);
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}
	.chart {
		margin: 0 -0.3rem;
	}
	.label {
		margin: 1.25rem 0 0.4rem;
	}
	.row {
		gap: 0.5rem;
		padding-right: 0.4rem;
	}
	.date {
		font-size: 0.9rem;
		color: var(--muted);
		font-variant-numeric: tabular-nums;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
</style>
