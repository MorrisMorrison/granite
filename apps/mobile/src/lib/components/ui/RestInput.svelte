<script lang="ts">
	import { joinDuration, splitDuration } from '$lib/duration';

	let { value = $bindable(0), testid }: { value?: number; testid?: string } = $props();

	const init = splitDuration(value);
	let min = $state(init.min);
	let sec = $state(init.sec);

	function commit() {
		value = joinDuration(min, sec);
		// Reflect any clamping (e.g. seconds > 59) back into the fields.
		const s = splitDuration(value);
		min = s.min;
		sec = s.sec;
	}
</script>

<div class="rest-input">
	<input
		type="number"
		min="0"
		inputmode="numeric"
		bind:value={min}
		onchange={commit}
		aria-label="Rest minutes"
		data-testid={testid ? `${testid}-min` : undefined}
	/>
	<span class="unit">m</span>
	<input
		type="number"
		min="0"
		max="59"
		inputmode="numeric"
		bind:value={sec}
		onchange={commit}
		aria-label="Rest seconds"
		data-testid={testid ? `${testid}-sec` : undefined}
	/>
	<span class="unit">s</span>
</div>

<style>
	.rest-input {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
	}
	.rest-input input {
		width: 3.4rem;
		padding: 0.3rem;
	}
	.unit {
		color: var(--muted);
		font-size: 0.85rem;
	}
</style>
