<script lang="ts">
	import { onMount } from 'svelte';
	import {
		muscleSets,
		volumeTrend,
		recentPersonalRecords,
		allTimeRecordsBoard,
		type PersonalRecordRow,
		type AllTimeRecordRow
	} from '$lib/repo/analytics';
	import type { MuscleSets, WeeklyVolume } from '$lib/analytics';
	import { syncNow } from '$lib/sync';
	import { prefs } from '$lib/stores/prefs.svelte';
	import { kgToDisplay } from '$lib/units';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import ListRow from '$lib/components/ui/ListRow.svelte';
	import LineChart from '$lib/components/ui/LineChart.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';

	let muscles = $state<MuscleSets[]>([]);
	let volume = $state<WeeklyVolume[]>([]);
	let prs = $state<PersonalRecordRow[]>([]);
	let records = $state<AllTimeRecordRow[]>([]);
	let loading = $state(true);
	let weeks = $state(8); // muscle-balance window + volume chart span

	const unit = $derived(prefs.current.weightUnit);
	const maxSets = $derived(muscles.reduce((m, x) => Math.max(m, x.sets), 0));
	const volValues = $derived(volume.slice(-weeks).map((v) => kgToDisplay(v.volume, unit) ?? 0));
	const hasVolume = $derived(volValues.some((v) => v > 0));
	const latestVol = $derived(volValues.length ? Math.round(volValues[volValues.length - 1]) : 0);

	// Convert a canonical-kg value to the display unit, rounded.
	const disp = (kg: number) => Math.round(kgToDisplay(kg, unit) ?? 0);

	function relDate(ts: number): string {
		const days = Math.floor((Date.now() - ts) / 86400000);
		if (days <= 0) return 'today';
		if (days === 1) return 'yesterday';
		if (days < 7) return `${days}d ago`;
		if (days < 28) return `${Math.floor(days / 7)}w ago`;
		return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
	}

	async function loadMuscle() {
		muscles = await muscleSets(weeks);
	}
	async function load() {
		[volume, prs, records] = await Promise.all([
			volumeTrend(),
			recentPersonalRecords(),
			allTimeRecordsBoard()
		]);
		await loadMuscle();
	}
	// Switching range only re-counts muscle sets; the volume chart slices client-side.
	function setRange(w: number) {
		if (w === weeks) return;
		weeks = w;
		void loadMuscle();
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
		<div class="range" role="group" aria-label="Time range">
			{#each [4, 8, 12] as w (w)}
				<button
					type="button"
					class="seg"
					class:active={weeks === w}
					onclick={() => setRange(w)}
					data-testid={`range-${w}w`}
				>
					{w}w
				</button>
			{/each}
		</div>

		<section class="block">
			<h2>Sets per muscle · last {weeks} weeks</h2>
			{#if muscles.length === 0}
				<p class="muted">No working sets in this range yet.</p>
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

		{#snippet recordRows(rows: (PersonalRecordRow | AllTimeRecordRow)[], rowTestid: string)}
			{#each rows as r (r.exerciseId + r.at)}
				<ListRow
					href={`/exercises/${r.exerciseId}`}
					title={r.exerciseName}
					subtitle={`${disp(r.weight)} ${unit} × ${r.reps} · ${relDate(r.at)}`}
					chevron
					testid={rowTestid}
				>
					{#snippet trailing()}
						<span class="pr-1rm">{disp(r.e1rm)} {unit}<small>e1RM</small></span>
					{/snippet}
				</ListRow>
			{/each}
		{/snippet}

		{#if records.length > 0}
			<section class="block">
				<h2>All-time records</h2>
				<div class="prs" data-testid="records-list">
					{@render recordRows(records, 'record-row')}
				</div>
			</section>
		{/if}

		{#if prs.length > 0}
			<section class="block">
				<h2>Recent PRs</h2>
				<div class="prs" data-testid="pr-list">
					{@render recordRows(prs, 'pr-row')}
				</div>
			</section>
		{/if}
	{/if}
</main>

<style>
	.range {
		display: inline-flex;
		gap: 0.25rem;
		margin-top: 0.25rem;
		padding: 0.2rem;
		background: var(--surface-2);
		border-radius: var(--radius-pill);
	}
	.seg {
		border: none;
		background: none;
		color: var(--muted);
		font: inherit;
		font-size: 0.8rem;
		font-weight: 600;
		padding: 0.3rem 0.75rem;
		border-radius: var(--radius-pill);
		cursor: pointer;
	}
	.seg.active {
		background: var(--surface);
		color: var(--text);
	}
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
	.prs {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.pr-1rm {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		font-size: 0.9rem;
		line-height: 1.1;
	}
	.pr-1rm small {
		font-weight: 400;
		font-size: 0.62rem;
		color: var(--muted);
	}
</style>
