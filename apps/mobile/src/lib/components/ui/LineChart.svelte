<script lang="ts">
	// A minimal dependency-free line chart: evenly-spaced values, accent line + dots.
	let { values, label = 'chart' }: { values: number[]; label?: string } = $props();

	const W = 320;
	const H = 120;
	const pad = 10;

	const geom = $derived.by(() => {
		if (values.length === 0) return { line: '', dots: [] as { cx: number; cy: number }[] };
		const min = Math.min(...values);
		const max = Math.max(...values);
		const sx = (i: number) => (values.length === 1 ? W / 2 : pad + (i / (values.length - 1)) * (W - 2 * pad));
		const sy = (v: number) => (max === min ? H / 2 : H - pad - ((v - min) / (max - min)) * (H - 2 * pad));
		const dots = values.map((v, i) => ({ cx: sx(i), cy: sy(v) }));
		const line = dots.map((d, i) => `${i ? 'L' : 'M'}${d.cx.toFixed(1)},${d.cy.toFixed(1)}`).join(' ');
		return { line, dots };
	});
</script>

<svg class="chart" viewBox="0 0 {W} {H}" role="img" aria-label={label}>
	<path d={geom.line} fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round" />
	{#each geom.dots as d}
		<circle cx={d.cx} cy={d.cy} r="2.5" fill="var(--accent)" />
	{/each}
</svg>

<style>
	.chart {
		width: 100%;
		height: auto;
		display: block;
	}
</style>
