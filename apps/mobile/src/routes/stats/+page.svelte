<script lang="ts">
	import { onMount } from 'svelte';
	import {
		muscleSets,
		volumeTrend,
		recentPersonalRecords,
		topLiftsTrend,
		type PersonalRecordRow,
		type TopLiftRow
	} from '#lib/repo/analytics.ts';
	import type { MuscleSets, WeeklyVolume } from '#lib/analytics.ts';
	import { syncNow } from '#lib/sync/index.ts';
	import { prefs } from '#lib/stores/prefs.svelte.ts';
	import { kgToDisplay } from '#lib/units.ts';
	import PageHeader from '#lib/components/ui/PageHeader.svelte';
	import LineChart from '#lib/components/ui/LineChart.svelte';
	import Sparkline from '#lib/components/ui/Sparkline.svelte';
	import RecordList from '#lib/components/RecordList.svelte';
	import EmptyState from '#lib/components/ui/EmptyState.svelte';
	import Icon from '#lib/components/ui/Icon.svelte';

	let muscles = $state<MuscleSets[]>([]);
	let volume = $state<WeeklyVolume[]>([]);
	let prs = $state<PersonalRecordRow[]>([]);
	let lifts = $state<TopLiftRow[]>([]);
	let loading = $state(true);
	let weeks = $state(8); // muscle-balance window + volume chart span

	const unit = $derived(prefs.current.weightUnit);
	const maxSets = $derived(muscles.reduce((m, x) => Math.max(m, x.sets), 0));
	const volValues = $derived(volume.slice(-weeks).map((v) => kgToDisplay(v.volume, unit) ?? 0));
	const hasVolume = $derived(volValues.some((v) => v > 0));
	const latestVol = $derived(volValues.length ? Math.round(volValues[volValues.length - 1]) : 0);

	const hasData = $derived(!loading && (hasVolume || muscles.length > 0));

	// Convert a canonical-kg value to the display unit, rounded.
	const disp = (kg: number) => Math.round(kgToDisplay(kg, unit) ?? 0);

	async function loadMuscle() {
		muscles = await muscleSets(weeks);
	}
	async function load() {
		[volume, prs, lifts] = await Promise.all([
			volumeTrend(),
			recentPersonalRecords(),
			topLiftsTrend()
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

{#snippet range()}
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
{/snippet}

<main class="container">
	<PageHeader
		title="Stats"
		eyebrow={hasData ? `Last ${weeks} weeks` : undefined}
		action={hasData ? range : undefined}
	/>

	{#if loading}
		<p class="muted">Loading…</p>
	{:else if !hasData}
		<EmptyState
			icon="history"
			title="No data yet"
			description="Log a few workouts and your training insights will show up here."
		/>
	{:else}
		<section class="card block" data-testid="weekly-volume">
			<p class="eyebrow">Weekly volume</p>
			{#if hasVolume}
				<p class="headline">
					<span class="big">{latestVol.toLocaleString()} {unit}</span>
					<span class="muted">this week</span>
				</p>
				<div class="chart"><LineChart values={volValues} label="Weekly training volume" /></div>
			{:else}
				<p class="muted empty">Not enough volume logged yet.</p>
			{/if}
		</section>

		<section class="card block">
			<p class="eyebrow">Sets per muscle</p>
			{#if muscles.length === 0}
				<p class="muted empty">No working sets in this range yet.</p>
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

		{#if lifts.length > 0}
			<section class="list-block">
				<h2 class="eyebrow list-label">Top lifts</h2>
				<div class="group" data-testid="top-lifts">
					{#each lifts as l (l.exerciseId)}
						<a class="lift" href={`/exercises/${l.exerciseId}`} data-testid="top-lift-row">
							<span class="lift-info">
								<span class="lift-name">{l.exerciseName}</span>
								<span class="lift-sub">{l.sessions} session{l.sessions === 1 ? '' : 's'}</span>
							</span>
							<span class="lift-spark">
								<Sparkline values={l.e1rmSeries} label={`${l.exerciseName} estimated 1RM trend`} />
							</span>
							<span class="lift-val">{disp(l.latestE1rm)} {unit}<small>e1RM</small></span>
							<span class="chev"><Icon name="chevron-right" size={18} /></span>
						</a>
					{/each}
				</div>
			</section>
		{/if}

		{#if prs.length > 0}
			<section class="list-block">
				<h2 class="eyebrow list-label">Recent PRs</h2>
				<RecordList rows={prs} {unit} rowTestid="pr-row" />
			</section>
		{/if}

		<a class="records-link" href="/stats/records" data-testid="records-link">
			<span>All-time records</span>
			<span class="chev"><Icon name="chevron-right" size={18} /></span>
		</a>
	{/if}
</main>

<style>
	.range {
		display: inline-flex;
		gap: 0.15rem;
		padding: 0.2rem;
		background: var(--elevated);
		border: 1px solid var(--border);
		border-radius: var(--radius-pill);
	}
	.seg {
		border: none;
		background: none;
		color: var(--muted);
		font: inherit;
		font-size: 0.78rem;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		padding: 0.25rem 0.65rem;
		border-radius: var(--radius-pill);
		cursor: pointer;
	}
	.seg.active {
		background: var(--surface);
		color: var(--text);
	}
	.block {
		margin-bottom: 0.75rem;
	}
	.headline {
		display: flex;
		align-items: baseline;
		flex-wrap: wrap;
		gap: 0.2rem 0.45rem;
		margin: 0.3rem 0 0.5rem;
	}
	.big {
		font-size: 1.5rem;
		font-weight: 650;
		letter-spacing: -0.02em;
		font-variant-numeric: tabular-nums;
	}
	.headline .muted {
		font-size: 0.85rem;
	}
	.empty {
		margin: 0.4rem 0 0;
		font-size: 0.85rem;
	}
	.chart {
		margin: 0 -0.3rem;
	}
	.bars {
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
		margin-top: 0.7rem;
	}
	.bar-row {
		display: grid;
		grid-template-columns: 5.5rem 1fr 1.75rem;
		align-items: center;
		gap: 0.6rem;
		font-size: 0.85rem;
	}
	.bar-label {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		color: var(--muted);
	}
	.bar-track {
		height: 0.45rem;
		background: var(--elevated);
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
	.list-block {
		margin-top: 1.25rem;
	}
	.list-label {
		margin: 0 0 0.4rem;
	}
	.group {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		overflow: hidden;
	}
	.lift {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto auto auto;
		align-items: center;
		gap: 0.75rem;
		padding: 0.7rem 0.75rem 0.7rem 1.1rem;
		color: var(--text);
		text-decoration: none;
		transition: background var(--dur-fast) var(--ease);
	}
	.lift + .lift {
		border-top: 1px solid var(--border);
	}
	.lift:hover {
		background: var(--elevated);
	}
	.lift-info {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		min-width: 0;
	}
	.lift-name {
		font-weight: 650;
		letter-spacing: -0.01em;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.lift-sub {
		font-size: 0.8rem;
		color: var(--muted);
		font-variant-numeric: tabular-nums;
	}
	.lift-spark {
		width: 56px;
		height: 22px;
		opacity: 0.85;
	}
	.lift-val {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		font-weight: 650;
		font-variant-numeric: tabular-nums;
		font-size: 0.92rem;
		line-height: 1.15;
	}
	.lift-val small {
		font-weight: 500;
		font-size: 0.62rem;
		letter-spacing: 0.04em;
		color: var(--faint);
	}
	.records-link {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		margin-top: 1.25rem;
		padding: 0.85rem 0.75rem 0.85rem 1.1rem;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		color: var(--text);
		text-decoration: none;
		font-weight: 650;
		letter-spacing: -0.01em;
		transition: background var(--dur-fast) var(--ease);
	}
	.records-link:hover {
		background: var(--elevated);
	}
	.chev {
		display: inline-flex;
		color: var(--faint);
	}
	.lift .chev {
		margin-left: -0.35rem;
	}
</style>
