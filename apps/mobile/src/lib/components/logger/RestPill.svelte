<script lang="ts">
	import { formatRest } from '#lib/duration.ts';

	// Active rest countdown: a centered "REST" eyebrow stacked above the time, with the
	// adjust/skip controls vertically centered beside it in one row.
	let {
		remaining,
		onbump,
		onskip
	}: { remaining: number; onbump: (delta: number) => void; onskip: () => void } = $props();
</script>

<div class="rest" data-testid="rest-pill">
	<button class="t" aria-label="Subtract 15 seconds" onclick={() => onbump(-15)}>−15</button>
	<div class="block">
		<span class="lbl">Rest</span>
		<span class="time" data-testid="rest-time">{formatRest(remaining)}</span>
	</div>
	<button class="t" aria-label="Add 15 seconds" onclick={() => onbump(15)}>+15</button>
	<button class="t" onclick={onskip}>Skip</button>
</div>

<style>
	.rest {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.9rem;
		align-self: center;
		padding: 0.4rem 1.1rem;
		background: var(--elevated);
		border: 1px solid var(--border-strong);
		border-radius: var(--radius-pill);
	}
	.block {
		display: flex;
		flex-direction: column;
		align-items: center;
		line-height: 1.1;
	}
	.lbl {
		font-size: 0.65rem;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--faint);
	}
	.time {
		font-size: 1.5rem;
		font-weight: 650;
		font-variant-numeric: tabular-nums;
		letter-spacing: -0.01em;
	}
	.t {
		font: inherit;
		font-size: 0.82rem;
		line-height: 1;
		color: var(--muted);
		background: none;
		border: none;
		cursor: pointer;
		padding: 0.3rem 0.2rem;
	}
	.t:hover {
		color: var(--text);
	}
</style>
