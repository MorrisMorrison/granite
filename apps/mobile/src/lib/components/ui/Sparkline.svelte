<script lang="ts">
	// A tiny dependency-free trend line (soft area fill + emphasized latest point) for
	// inline use in list rows. Needs at least two points; renders nothing otherwise.
	let {
		values,
		label = 'trend',
		width = 72,
		height = 24
	}: { values: number[]; label?: string; width?: number; height?: number } = $props();

	const pad = 2;
	const uid = $props.id();
	const fillId = `sl-fill-${uid}`;

	const geom = $derived.by(() => {
		if (values.length < 2) return { line: '', area: '', last: null as { x: number; y: number } | null };
		const min = Math.min(...values);
		const max = Math.max(...values);
		const sx = (i: number) => pad + (i / (values.length - 1)) * (width - 2 * pad);
		const sy = (v: number) =>
			max === min ? height / 2 : height - pad - ((v - min) / (max - min)) * (height - 2 * pad);
		const pts = values.map((v, i) => ({ x: sx(i), y: sy(v) }));
		const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
		const base = height - pad;
		const area = `${line} L${pts[pts.length - 1].x.toFixed(1)},${base} L${pts[0].x.toFixed(1)},${base} Z`;
		return { line, area, last: pts[pts.length - 1] };
	});
</script>

{#if geom.line}
	<svg class="spark" {width} {height} viewBox="0 0 {width} {height}" role="img" aria-label={label}>
		<defs>
			<linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
				<stop offset="0%" stop-color="var(--accent)" stop-opacity="0.18" />
				<stop offset="100%" stop-color="var(--accent)" stop-opacity="0" />
			</linearGradient>
		</defs>
		<path d={geom.area} fill="url(#{fillId})" stroke="none" />
		<path
			d={geom.line}
			fill="none"
			stroke="var(--accent)"
			stroke-width="1.5"
			stroke-linejoin="round"
			stroke-linecap="round"
		/>
		{#if geom.last}
			<circle cx={geom.last.x} cy={geom.last.y} r="1.6" fill="var(--accent)" />
		{/if}
	</svg>
{/if}

<style>
	.spark {
		display: block;
	}
</style>
