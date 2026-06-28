<script lang="ts">
	import { onMount } from 'svelte';
	import { muscleSetsThisWeek, volumeTrend } from '$lib/repo/analytics';
	import type { MuscleSets, WeeklyVolume } from '$lib/analytics';
	import { syncNow } from '$lib/sync';
	import { prefs } from '$lib/stores/prefs.svelte';
	import { kgToDisplay } from '$lib/units';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import LineChart from '$lib/components/ui/LineChart.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';

	let muscles = $state<MuscleSets[]>([]);
	let volume = $state<WeeklyVolume[]>([]);
	let loading = $state(true);

	const unit = $derived(prefs.current.weightUnit);
	const maxSets = $derived(muscles.reduce((m, x) => Math.max(m, x.sets), 0));
	const volValues = $derived(volume.map((v) => kgToDisplay(v.volume, unit) ?? 0));
	const hasVolume = $derived(volValues.some((v) => v > 0));
	const latestVol = $derived(volValues.length ? Math.round(volValues[volValues.length - 1]) : 0);

	async function load() {
		[muscles, volume] = await Promise.all([muscleSetsThisWeek(), volumeTrend()]);
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
</script>

<svelte:head><title>Stats · Granite</title></svelte:head>

<main class="container">
	<PageHeader title="Stats" />

	{#if loading}
		<p class="muted">Loading…</p>
	{:else if !hasVolume && muscles.length === 0}
		<EmptyState
			icon="history"
			title="No data yet"
			description="Log a few workouts and your training insights will show up here."
		/>
	{:else}
		<section class="block">
			<h2>Sets per muscle · this week</h2>
			{#if muscles.length === 0}
				<p class="muted">No working sets logged this week yet.</p>
			{:else}
				<div class="bars" data-testid="muscle-bars">
					{#each muscles as m (m.muscle)}
						<div class="bar-row">
							<span class="bar-label">{m.muscle}</span>
							<span class="bar-track">
								<span class="bar-fill" style="width: {maxSets ? (m.sets / maxSets) * 100 : 0}%"></span>
							</span>
							<span class="bar-val">{m.sets}</span>
						</div>
					{/each}
				</div>
			{/if}
		</section>

		<section class="block">
			<h2>Weekly volume</h2>
			{#if hasVolume}
				<p class="muted vol-latest">This week: {latestVol.toLocaleString()} {unit}</p>
				<div class="card chart"><LineChart values={volValues} label="Weekly training volume" /></div>
			{:else}
				<p class="muted">Not enough volume logged yet.</p>
			{/if}
		</section>
	{/if}
</main>

<style>
	.block {
		margin-top: 1.5rem;
	}
	h2 {
		font-size: 0.95rem;
		font-weight: 600;
		margin: 0 0 0.6rem;
	}
	.bars {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.bar-row {
		display: grid;
		grid-template-columns: 5.5rem 1fr 1.75rem;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.85rem;
	}
	.bar-label {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		color: var(--muted);
	}
	.bar-track {
		height: 0.5rem;
		background: var(--surface-2);
		border-radius: var(--radius-pill);
		overflow: hidden;
	}
	.bar-fill {
		display: block;
		height: 100%;
		background: var(--accent);
		border-radius: var(--radius-pill);
	}
	.bar-val {
		text-align: right;
		font-variant-numeric: tabular-nums;
		font-weight: 600;
	}
	.vol-latest {
		font-size: 0.85rem;
		margin: 0 0 0.6rem;
	}
	.chart {
		padding: 0.75rem;
	}
</style>
