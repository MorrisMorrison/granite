<script lang="ts">
	import Sheet from '#lib/components/ui/Sheet.svelte';

	// Logger heading: "{elapsed} · {ROUTINE}" eyebrow, a deload chip (routine starts only)
	// and the editable workout title.
	let {
		elapsed,
		routineName = '',
		title = $bindable(''),
		showDeload = false,
		deloadPct = 0,
		ondeload
	}: {
		elapsed: string;
		routineName?: string;
		title?: string;
		showDeload?: boolean;
		deloadPct?: number;
		ondeload: (pct: number) => void;
	} = $props();

	let open = $state(false);
	const OPTIONS = [0, 5, 10, 15, 20];
	const eyebrow = $derived(routineName ? `${elapsed} · ${routineName}` : elapsed);
</script>

<header class="head">
	<div class="top">
		<p class="eyebrow" data-testid="elapsed">{eyebrow}</p>
		{#if showDeload}
			<button class="chip" onclick={() => (open = true)} data-testid="deload">
				Deload · {deloadPct === 0 ? 'none' : `−${deloadPct}%`}
			</button>
		{/if}
	</div>
	<input
		class="title-input"
		placeholder="Workout title"
		bind:value={title}
		aria-label="Workout title"
		data-testid="field-workout-title"
	/>
</header>

<Sheet {open} title="Deload" onclose={() => (open = false)}>
	<p class="hint">Scales every prefilled weight from the routine's targets.</p>
	<ul class="opts">
		{#each OPTIONS as p (p)}
			<li>
				<button
					class="opt"
					class:on={deloadPct === p}
					data-testid={`deload-${p}`}
					onclick={() => {
						ondeload(p);
						open = false;
					}}
				>
					{p === 0 ? 'None' : `−${p}%`}
				</button>
			</li>
		{/each}
	</ul>
</Sheet>

<style>
	.head {
		margin-bottom: 1rem;
	}
	.top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		min-height: 1.6rem;
	}
	.eyebrow {
		font-variant-numeric: tabular-nums;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.chip {
		flex-shrink: 0;
		font: inherit;
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--muted);
		background: var(--elevated);
		border: 1px solid var(--border);
		border-radius: var(--radius-pill);
		padding: 0.2rem 0.65rem;
		cursor: pointer;
	}
	.hint {
		margin: 0.25rem 0 0.5rem;
		font-size: 0.82rem;
		color: var(--muted);
	}
	.opts {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.opt {
		width: 100%;
		text-align: left;
		padding: 0.7rem 0.5rem;
		font: inherit;
		background: none;
		border: none;
		border-bottom: 1px solid var(--border);
		color: var(--text);
		cursor: pointer;
	}
	.opt.on {
		color: var(--accent);
		font-weight: 600;
	}
</style>
