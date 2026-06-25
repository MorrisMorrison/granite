<script lang="ts">
	import Icon from './Icon.svelte';

	let {
		name,
		label,
		href = undefined,
		onclick = undefined,
		size = 16,
		testid = undefined
	}: {
		name: string;
		label: string; // required — icon-only controls need an accessible name
		href?: string;
		onclick?: () => void;
		size?: number;
		testid?: string;
	} = $props();
</script>

{#if href}
	<a class="ib" {href} aria-label={label} data-testid={testid}><Icon {name} {size} /></a>
{:else}
	<button class="ib" {onclick} aria-label={label} data-testid={testid}><Icon {name} {size} /></button>
{/if}

<style>
	.ib {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		padding: 6px;
		background: none;
		border: none;
		color: var(--muted);
		border-radius: var(--radius-md);
		cursor: pointer;
		text-decoration: none;
	}
	.ib:hover {
		background: var(--surface-2);
		color: var(--text);
	}
	.ib :global(svg) {
		display: block;
	}
</style>
