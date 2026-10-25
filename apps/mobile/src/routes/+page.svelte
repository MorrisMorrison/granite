<script lang="ts">
	import { onMount } from 'svelte';
	import { auth } from '#lib/stores/auth.svelte.ts';
	import { listRoutines, getRoutine, type RoutineRow } from '#lib/repo/routines.ts';
	import { listWorkouts, type WorkoutSummary } from '#lib/repo/workouts.ts';
	import { listBodyweight } from '#lib/repo/bodyweight.ts';
	import {
		computeHomeStats,
		lastDoneAt,
		nextRoutine,
		relativeDay,
		weekDays,
		type HomeStats,
		type WeekDay
	} from '#lib/stats.ts';
	import { prefs } from '#lib/stores/prefs.svelte.ts';
	import { kgToDisplay } from '#lib/units.ts';
	import { syncNow } from '#lib/sync/index.ts';
	import { install } from '#lib/stores/install.svelte.ts';
	import { installText, shouldOffer } from '#lib/install.ts';
	import Button from '#lib/components/ui/Button.svelte';

	let routines = $state<RoutineRow[]>([]);
	let workouts = $state<WorkoutSummary[]>([]);
	let stats = $state<HomeStats | null>(null);
	let week = $state<WeekDay[]>([]);
	let latestWeight = $state<number | null>(null);
	let exerciseCount = $state<number | null>(null);

	const unit = $derived(prefs.current.weightUnit);
	const next = $derived(nextRoutine(routines, workouts));
	const nextDone = $derived(next ? lastDoneAt(next, workouts) : null);
	const last = $derived(workouts[0] ?? null);

	async function load() {
		const [r, w, bw] = await Promise.all([listRoutines(), listWorkouts(), listBodyweight()]);
		const now = Date.now();
		const n = nextRoutine(r, w);
		const count = n ? ((await getRoutine(n.id))?.exercises.length ?? 0) : null;
		// Assign only after everything is fetched so the hero never mixes old and new data.
		routines = r;
		workouts = w;
		stats = computeHomeStats(w, now);
		week = weekDays(w, now);
		latestWeight = bw.length ? bw[0].weight : null;
		exerciseCount = count;
	}

	onMount(async () => {
		try {
			await load();
		} catch {
			/* local read failed — still sync, then retry below */
		}
		try {
			await syncNow();
			await load();
		} catch {
			/* offline — keep local */
		}
	});

	const lastSub = (w: WorkoutSummary) => {
		const m = minutes(w);
		return m ? `${relativeDay(w.start_time, Date.now())} · ${m} min` : relativeDay(w.start_time, Date.now());
	};
	const minutes = (w: WorkoutSummary) =>
		w.end_time ? Math.max(1, Math.round((w.end_time - w.start_time) / 60000)) : null;

	const today = new Date().toLocaleDateString(undefined, {
		weekday: 'long',
		day: 'numeric',
		month: 'long'
	});
	const hour = new Date().getHours();
	const hello = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
	const name = $derived(
		(auth.user?.display_name?.trim() || auth.user?.email?.split('@')[0] || '').trim()
	);
	const greeting = $derived(name ? `${hello}, ${name}` : hello);

	// Suggest the home screen once there's a first workout (never on a first visit).
	const offerInstall = $derived(shouldOffer({
		platform: install.platform,
		standalone: install.standalone,
		dismissed: install.dismissed,
		workouts: stats?.total ?? 0
	}));
</script>

<svelte:head><title>Granite</title></svelte:head>

<main class="container">
	<header class="head">
		<p class="eyebrow">{today}</p>
		<h1>{greeting}</h1>
	</header>

	{#if next}
		<section class="hero" data-testid="today-next-routine">
			<p class="eyebrow">Next up</p>
			<h2 class="hero-title">{next.title}</h2>
			<p class="hero-meta">
				{#if exerciseCount != null}{exerciseCount} exercise{exerciseCount === 1 ? '' : 's'}{/if}{#if nextDone}{exerciseCount != null ? ' · ' : ''}last done {relativeDay(nextDone, Date.now()).toLowerCase()}{/if}
			</p>
			<Button href={`/log?routine=${next.id}`} icon="play" block testid="today-start-routine">
				Start {next.title}
			</Button>
			<a class="empty-link" href="/log" data-testid="btn-start-workout">or start an empty workout</a>
		</section>
	{:else}
		<Button href="/log" icon="play" block testid="btn-start-workout">Start workout</Button>
	{/if}

	{#if stats && stats.total > 0}
		<section class="week" data-testid="home-stats">
			<div class="week-text">
				<p class="eyebrow">This week</p>
				<p class="week-sub">
					<span data-testid="stat-this-week">{stats.thisWeek}</span> workout{stats.thisWeek === 1 ? '' : 's'} ·
					<span data-testid="stat-streak">{stats.streakWeeks}</span>-wk streak
				</p>
			</div>
			<div class="dots" aria-hidden="true">
				{#each week as d, i (i)}
					<div class="day" class:future={d.future}>
						<span class="dot" class:trained={d.trained} class:now={d.today}></span>
						<span class="day-l">{d.label}</span>
					</div>
				{/each}
			</div>
		</section>
	{/if}

	<div class="pair">
		<a class="mini" href={last ? `/history/${last.id}` : '/history'} data-testid="today-last-workout">
			<p class="eyebrow">Last workout</p>
			<p class="mini-main">{last ? last.title || 'Workout' : '—'}</p>
			<p class="mini-sub">
				{#if last}{lastSub(last)}{:else}Nothing logged yet{/if}
			</p>
		</a>
		<a class="mini" href="/bodyweight" data-testid="bodyweight-link">
			<p class="eyebrow">Bodyweight</p>
			<p class="mini-main">{latestWeight != null ? `${kgToDisplay(latestWeight, unit)} ${unit}` : 'Log'}</p>
			<p class="mini-sub">{latestWeight != null ? 'Latest entry' : 'Track your weight'}</p>
		</a>
	</div>

	{#if offerInstall}
		<section class="install card" data-testid="install-card" aria-labelledby="install-title">
			<h2 id="install-title">Keep Granite on your home screen</h2>
			<p>{@html installText(install.platform, install.canPrompt)}</p>
			<div class="install-actions">
				{#if install.canPrompt}
					<Button size="sm" icon="download" onclick={() => install.install()} testid="btn-install-card">
						Install
					</Button>
				{:else if install.platform !== 'ios'}
					<Button size="sm" variant="outline" onclick={() => (install.sheetOpen = true)} testid="btn-install-how">
						Show me how
					</Button>
				{/if}
				<Button size="sm" variant="ghost" onclick={() => install.dismiss()} testid="btn-install-dismiss">
					No thanks
				</Button>
			</div>
		</section>
	{/if}
</main>

<style>
	.head {
		margin-bottom: 1.1rem;
	}
	.head h1 {
		margin: 0.2rem 0 0;
		font-size: 1.6rem;
		font-weight: 650;
		letter-spacing: -0.02em;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.eyebrow {
		margin: 0;
		font-size: 0.7rem;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--faint);
	}
	.hero {
		padding: 1.15rem;
		border: 1px solid rgba(37, 99, 235, 0.35);
		border-radius: var(--radius-lg);
		background:
			linear-gradient(160deg, rgba(37, 99, 235, 0.16), rgba(37, 99, 235, 0.02) 60%), var(--surface);
	}
	.hero-title {
		margin: 0.3rem 0 0.15rem;
		font-size: 1.35rem;
		font-weight: 650;
		letter-spacing: -0.015em;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.hero-meta {
		margin: 0 0 0.9rem;
		font-size: 0.85rem;
		color: var(--muted);
	}
	.empty-link {
		display: block;
		margin: 0.35rem 0 -0.4rem;
		padding: 0.4rem;
		text-align: center;
		font-size: 0.85rem;
		color: var(--muted);
		text-decoration: none;
	}
	.empty-link:hover {
		color: var(--text);
	}
	.week {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.6rem 1rem;
		margin-top: 0.75rem;
		padding: 0.85rem 1rem;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
	}
	.week-sub {
		margin: 0.25rem 0 0;
		font-size: 0.85rem;
		color: var(--muted);
		font-variant-numeric: tabular-nums;
	}
	.dots {
		display: flex;
		gap: 0.4rem;
		flex-shrink: 0;
		padding: 3px;
	}
	.day {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.25rem;
	}
	.day.future {
		opacity: 0.45;
	}
	.dot {
		width: 0.85rem;
		height: 0.85rem;
		border-radius: 50%;
		background: var(--surface-2);
		border: 1px solid var(--border);
		box-sizing: border-box;
	}
	.dot.trained {
		background: var(--accent);
		border-color: var(--accent);
	}
	.dot.now {
		box-shadow:
			0 0 0 1.5px var(--bg),
			0 0 0 2.75px var(--muted);
	}
	.day-l {
		font-size: 0.6rem;
		color: var(--faint);
	}
	.pair {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.75rem;
		margin-top: 0.75rem;
	}
	.mini {
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		padding: 0.85rem 1rem;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		color: var(--text);
		text-decoration: none;
	}
	.mini p {
		margin: 0;
	}
	.mini-main {
		font-size: 1rem;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.mini-sub {
		font-size: 0.8rem;
		color: var(--muted);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.install {
		margin-top: 0.75rem;
		padding: 0.9rem 1rem;
	}
	.install h2 {
		margin: 0 0 0.35rem;
		font-size: 0.95rem;
		font-weight: 600;
	}
	.install p {
		margin: 0 0 0.75rem;
		font-size: 0.85rem;
		color: var(--muted);
		line-height: 1.45;
	}
	.install p :global(b) {
		color: var(--text);
	}
	.install p :global(.share-icon) {
		width: 1em;
		height: 1em;
		vertical-align: -0.12em;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.5;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.install-actions {
		display: flex;
		gap: 0.5rem;
	}
</style>
