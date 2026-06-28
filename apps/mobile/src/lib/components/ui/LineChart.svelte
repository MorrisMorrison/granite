<script lang="ts">
	// A minimal dependency-free line chart: evenly-spaced values drawn as an accent
	// line over a soft area fill, with the latest point emphasized.
	let { values, label = 'chart' }: { values: number[]; label?: string } = $props();

	const W = 320;
	const H = 120;
	const pad = 10;
	const uid = $props.id(); // unique per instance — multiple charts per page
	const fillId = `lc-fill-${uid}`;

	const geom = $derived.by(() => {
		if (values.length === 0) return { line: '', area: '', last: null as { cx: number; cy: number } | null };
		const min = Math.min(...values);
		const max = Math.max(...values);
		const sx = (i: number) => (values.length === 1 ? W / 2 : pad + (i / (values.length - 1)) * (W - 2 * pad));
		const sy = (v: number) => (max === min ? H / 2 : H - pad - ((v - min) / (max - min)) * (H - 2 * pad));
		const pts = values.map((v, i) => ({ cx: sx(i), cy: sy(v) }));
		const line = pts.map((d, i) => `${i ? 'L' : 'M'}${d.cx.toFixed(1)},${d.cy.toFixed(1)}`).join(' ');
		const base = H - pad;
		const area =
			pts.length >= 2
				? `${line} L${pts[pts.length - 1].cx.toFixed(1)},${base} L${pts[0].cx.toFixed(1)},${base} Z`
				: '';
		return { line, area, last: pts[pts.length - 1] };
	});
</script>

<svg class="chart" viewBox="0 0 {W} {H}" role="img" aria-label={label}>
	<defs>
		<linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
			<stop offset="0%" stop-color="var(--accent)" stop-opacity="0.22" />
			<stop offset="100%" stop-color="var(--accent)" stop-opacity="0" />
		</linearGradient>
	</defs>
	{#if geom.area}<path d={geom.area} fill="url(#{fillId})" stroke="none" />{/if}
	<path
		d={geom.line}
		fill="none"
		stroke="var(--accent)"
		stroke-width="2"
		stroke-linejoin="round"
		stroke-linecap="round"
	/>
	{#if geom.last}
		<circle cx={geom.last.cx} cy={geom.last.cy} r="3.5" fill="var(--accent)" />
	{/if}
</svg>

<style>
	.chart {
		width: 100%;
		height: auto;
		display: block;
	}
</style>
