<script lang="ts">
	import {
		addMonth,
		countInMonth,
		isAfterMonth,
		markedDays,
		monthGrid,
		monthLabel,
		startOfDay
	} from '$lib/calendar';

	let {
		dates = [],
		selected = null,
		onselect,
		itemNoun = 'workout'
	}: {
		dates?: number[];
		selected?: number | null;
		onselect?: (dayMs: number | null) => void;
		itemNoun?: string;
	} = $props();

	const now = Date.now();
	const today = startOfDay(now);
	const start = new Date(now);
	let viewYear = $state(start.getFullYear());
	let viewMonth = $state(start.getMonth());

	const grid = $derived(monthGrid(viewYear, viewMonth));
	const marks = $derived(markedDays(dates, viewYear, viewMonth));
	const count = $derived(countInMonth(dates, viewYear, viewMonth));
	// No future browsing: the next arrow is disabled once we're on the current month.
	const canNext = $derived(!isAfterMonth(viewYear, viewMonth, now) && !sameMonthAsNow());

	const DOW = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

	function sameMonthAsNow(): boolean {
		return viewYear === start.getFullYear() && viewMonth === start.getMonth();
	}
	function prev() {
		({ year: viewYear, month: viewMonth } = addMonth(viewYear, viewMonth, -1));
	}
	function next() {
		if (canNext) ({ year: viewYear, month: viewMonth } = addMonth(viewYear, viewMonth, 1));
	}
	function pick(ms: number) {
		onselect?.(selected != null && startOfDay(selected) === ms ? null : ms);
	}
</script>

<div class="cal">
	<div class="cal-hd">
		<button class="nav" onclick={prev} aria-label="Previous month" data-testid="cal-prev">
			<span aria-hidden="true">‹</span>
		</button>
		<div class="cal-title" data-testid="cal-title">
			{monthLabel(viewYear, viewMonth)} · {count} {itemNoun}{count === 1 ? '' : 's'}
		</div>
		<button
			class="nav"
			onclick={next}
			disabled={!canNext}
			aria-label="Next month"
			data-testid="cal-next"
		>
			<span aria-hidden="true">›</span>
		</button>
	</div>

	<div class="grid">
		{#each DOW as d}<span class="dow">{d}</span>{/each}
		{#each Array(grid.lead) as _}<span></span>{/each}
		{#each grid.days as c (c.ms)}
			{@const isMarked = marks.has(c.day)}
			<button
				class="day"
				class:marked={isMarked}
				class:today={c.ms === today}
				class:sel={selected != null && startOfDay(selected) === c.ms}
				disabled={!isMarked}
				onclick={() => pick(c.ms)}
				data-testid={isMarked ? 'cal-day-marked' : 'cal-day'}
			>
				{c.day}
			</button>
		{/each}
	</div>
</div>

<style>
	.cal {
		margin-bottom: 1rem;
	}
	.cal-hd {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 0.4rem;
	}
	.cal-title {
		font-size: 0.85rem;
		font-weight: 600;
	}
	.nav {
		background: transparent;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		color: var(--text);
		width: 1.75rem;
		height: 1.75rem;
		line-height: 1;
		cursor: pointer;
	}
	.nav:disabled {
		opacity: 0.35;
		cursor: default;
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		gap: 3px;
		text-align: center;
	}
	.dow {
		font-size: 0.7rem;
		color: var(--muted);
		padding-bottom: 2px;
	}
	.day {
		aspect-ratio: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.8rem;
		border: none;
		background: transparent;
		color: var(--muted);
		border-radius: var(--radius);
		padding: 0;
	}
	.day:disabled {
		cursor: default;
	}
	.day.today {
		outline: 1px solid var(--border-strong);
		color: var(--text);
	}
	.day.marked {
		background: var(--accent-subtle);
		color: var(--accent);
		font-weight: 600;
		cursor: pointer;
	}
	.day.sel {
		background: var(--accent);
		color: var(--accent-text);
	}
</style>
