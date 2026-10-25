<script lang="ts">
	// The square set badge shared by the logger and workout detail: a running number for
	// work sets, W (amber) for warm-ups, D / F for drop and failure sets. With `onclick`
	// it's a button (the logger opens the set-type sheet from it); otherwise a plain label.
	let {
		label,
		type = 'normal',
		onclick = undefined,
		ariaLabel = undefined,
		testid = undefined
	}: {
		label: string; // from setBadge(): 1/2/3…, W, D or F
		type?: string; // the set's set_type
		onclick?: () => void;
		ariaLabel?: string;
		testid?: string;
	} = $props();

	const warm = $derived(type === 'warmup');
	const other = $derived(type === 'drop' || type === 'failure');
</script>

{#if onclick}
	<button class="badge" class:warm class:other {onclick} aria-label={ariaLabel} data-testid={testid}
		>{label}</button
	>
{:else}
	<span class="badge" class:warm class:other aria-label={ariaLabel} data-testid={testid}>{label}</span>
{/if}

<style>
	.badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2rem;
		height: 2rem;
		padding: 0;
		font: inherit;
		font-size: 0.85rem;
		font-weight: 650;
		font-variant-numeric: tabular-nums;
		color: var(--muted);
		background: var(--elevated);
		border: none;
		border-radius: var(--radius-sm);
	}
	button.badge {
		cursor: pointer;
	}
	.badge.warm {
		color: var(--warning);
		background: color-mix(in srgb, var(--warning) 14%, transparent);
	}
	.badge.other {
		color: var(--text);
		background: var(--border-strong);
	}
</style>
