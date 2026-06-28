<script lang="ts">
	// A tiny dependency-free trend line (no axes or dots) for inline use in list rows.
	// Needs at least two points; renders nothing otherwise.
	let {
		values,
		label = 'trend',
		width = 72,
		height = 24
	}: { values: number[]; label?: string; width?: number; height?: number } = $props();

	const pad = 2;
	const line = $derived.by(() => {
		if (values.length < 2) return '';
		const min = Math.min(...values);
		const max = Math.max(...values);
		const sx = (i: number) => pad + (i / (values.length - 1)) * (width - 2 * pad);
		const sy = (v: number) =>
			max === min ? height / 2 : height - pad - ((v - min) / (max - min)) * (height - 2 * pad);
		return values.map((v, i) => `${i ? 'L' : 'M'}${sx(i).toFixed(1)},${sy(v).toFixed(1)}`).join(' ');
	});
</script>

{#if line}
	<svg class="spark" {width} {height} viewBox="0 0 {width} {height}" role="img" aria-label={label}>
		<path
			d={line}
			fill="none"
			stroke="var(--accent)"
			stroke-width="1.5"
			stroke-linejoin="round"
			stroke-linecap="round"
		/>
	</svg>
{/if}

<style>
	.spark {
		display: block;
	}
</style>
