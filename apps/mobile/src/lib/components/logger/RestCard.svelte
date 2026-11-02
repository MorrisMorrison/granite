<script lang="ts">
	import { formatRest } from '#lib/duration.ts';
	import Button from '#lib/components/ui/Button.svelte';

	// Active rest countdown, floating above the logger footer: a progress ring holding the
	// time, dead center of the card. The side columns are equal width, so "REST" on the left
	// balances Skip on the right and the ring stays centered whatever their widths.
	let {
		remaining,
		total,
		onbump,
		onskip
	}: {
		remaining: number;
		total: number;
		onbump: (delta: number) => void;
		onskip: () => void;
	} = $props();

	const R = 34;
	const CIRCUMFERENCE = 2 * Math.PI * R;
	const fraction = $derived(total > 0 ? Math.min(1, Math.max(0, remaining / total)) : 0);
</script>

<div class="rest" data-testid="rest-card">
	<span class="eyebrow lbl">Rest</span>
	<div class="mid">
		<button class="step" aria-label="Subtract 15 seconds" onclick={() => onbump(-15)}>−15</button>
		<div class="ring">
			<svg viewBox="0 0 76 76" aria-hidden="true">
				<circle class="track" cx="38" cy="38" r={R} />
				<circle
					class="progress"
					data-testid="rest-progress"
					cx="38"
					cy="38"
					r={R}
					stroke-dasharray={CIRCUMFERENCE}
					stroke-dashoffset={CIRCUMFERENCE * (1 - fraction)}
				/>
			</svg>
			<span class="time" data-testid="rest-time">{formatRest(remaining)}</span>
		</div>
		<button class="step" aria-label="Add 15 seconds" onclick={() => onbump(15)}>+15</button>
	</div>
	<div class="skip">
		<Button variant="outline" size="sm" onclick={onskip} testid="btn-skip-rest">Skip</Button>
	</div>
</div>

<style>
	.rest {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
		align-items: center;
		gap: 0.25rem;
		padding: 0.6rem 0.75rem;
		background: var(--elevated);
		border: 1px solid var(--border-strong);
		border-radius: var(--radius-lg);
	}
	.lbl {
		justify-self: start;
	}
	.skip {
		justify-self: end;
	}
	.mid {
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}
	.step {
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		width: 2.75rem;
		height: 2.75rem;
		padding: 0;
		font: inherit;
		font-size: 0.75rem;
		font-weight: 600;
		line-height: 1;
		font-variant-numeric: tabular-nums;
		color: var(--muted);
		background: none;
		border: 1px solid var(--border-strong);
		border-radius: 50%;
		cursor: pointer;
	}
	.step:hover {
		color: var(--text);
	}
	.ring {
		position: relative;
		display: grid;
		place-items: center;
		width: 4.75rem;
		height: 4.75rem;
	}
	.ring svg {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		transform: rotate(-90deg);
	}
	circle {
		fill: none;
		stroke-width: 4;
	}
	.track {
		stroke: var(--border-strong);
	}
	.progress {
		stroke: var(--accent);
		stroke-linecap: round;
		transition: stroke-dashoffset 1s linear;
	}
	.time {
		position: relative;
		font-size: 1.2rem;
		font-weight: 650;
		line-height: 1;
		font-variant-numeric: tabular-nums;
		letter-spacing: -0.01em;
	}
	@media (max-width: 359px) {
		.mid {
			gap: 0.35rem;
		}
		.step {
			width: 2.5rem;
			height: 2.5rem;
		}
		.ring {
			width: 4rem;
			height: 4rem;
		}
		.time {
			font-size: 1.05rem;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.progress {
			transition: none;
		}
	}
</style>
