<script lang="ts">
	import { formatRest } from '#lib/duration.ts';

	// Active rest countdown: the time digits are the vertical center of the pill. The "REST"
	// eyebrow is absolutely positioned above them so it doesn't shift the digits off-center,
	// and the adjust/skip controls are vertically centered on the digits in one row.
	let {
		remaining,
		onbump,
		onskip
	}: { remaining: number; onbump: (delta: number) => void; onskip: () => void } = $props();
</script>

<div class="rest" data-testid="rest-pill">
	<button class="t" aria-label="Subtract 15 seconds" onclick={() => onbump(-15)}>−15</button>
	<div class="timewrap">
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
		/* Top padding leaves room for the absolutely-positioned REST label above the digits. */
		padding: 1rem 1.1rem 0.5rem;
		background: var(--elevated);
		border: 1px solid var(--border-strong);
		border-radius: var(--radius-pill);
	}
	.timewrap {
		position: relative;
		line-height: 1.1;
	}
	.lbl {
		position: absolute;
		bottom: 100%;
		left: 50%;
		transform: translateX(-50%);
		margin-bottom: 1px;
		white-space: nowrap;
		line-height: 1;
		font-size: 0.65rem;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--faint);
	}
	.time {
		display: block;
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
