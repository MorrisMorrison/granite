<script lang="ts">
	import { onMount } from 'svelte';
	import {
		listBodyweight,
		addBodyweight,
		deleteBodyweight,
		type BodyweightEntry
	} from '$lib/repo/bodyweight';
	import { syncNow } from '$lib/sync';
	import { prefs } from '$lib/stores/prefs.svelte';
	import { displayToKg, kgToDisplay } from '$lib/units';
	import BackLink from '$lib/components/ui/BackLink.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import LineChart from '$lib/components/ui/LineChart.svelte';
	import IconButton from '$lib/components/ui/IconButton.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';

	let entries = $state<BodyweightEntry[]>([]);
	let loading = $state(true);
	let input = $state<number | null>(null);
	let saving = $state(false);

	const unit = $derived(prefs.current.weightUnit);
	// Oldest → newest, in the display unit, for the chart.
	const chartValues = $derived(
		[...entries].reverse().map((e) => kgToDisplay(e.weight, unit) ?? 0)
	);

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
	function w(kg: number): string {
		const v = kgToDisplay(kg, unit);
		return v == null ? '—' : String(v);
	}
</script>

<svelte:head><title>Bodyweight · Granite</title></svelte:head>

<main class="container">
	<BackLink href="/" label="Today" />
	<h1>Bodyweight</h1>

	<div class="add">
		<input
			type="number"
			inputmode="decimal"
			step="0.1"
			placeholder="Weight ({unit})"
			bind:value={input}
			data-testid="field-bodyweight"
		/>
		<Button onclick={logWeight} disabled={saving || !input} testid="btn-log-bodyweight">Log</Button>
	</div>

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
			<div class="card chart"><LineChart values={chartValues} label="Bodyweight over time" /></div>
		{/if}
		<div class="list">
			{#each entries as e (e.id)}
				<div class="row card" data-testid="bw-row">
					<div>
						<div class="wt">{w(e.weight)} {unit}</div>
						<div class="muted date">{fmtDate(e.recorded_at)}</div>
					</div>
					<IconButton name="trash" label="Delete weigh-in" onclick={() => remove(e.id)} />
				</div>
			{/each}
		</div>
	{/if}
</main>

<style>
	.add {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 1.25rem;
	}
	.add input {
		flex: 1;
	}
	.chart {
		margin-bottom: 1rem;
	}
	.list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.row {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	.wt {
		font-weight: 600;
	}
	.date {
		font-size: 0.82rem;
		margin-top: 2px;
	}
</style>
