<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon from './Icon.svelte';

	let {
		href = undefined,
		onclick = undefined,
		title,
		subtitle = undefined,
		testid = undefined,
		chevron = false,
		trailing
	}: {
		href?: string;
		onclick?: () => void;
		title: string;
		subtitle?: string;
		testid?: string;
		chevron?: boolean;
		trailing?: Snippet;
	} = $props();
</script>

{#snippet inner()}
	<div class="lr-main">
		<div class="lr-title">{title}</div>
		{#if subtitle}<div class="lr-sub">{subtitle}</div>{/if}
	</div>
	{#if trailing}<div class="lr-trail">{@render trailing()}</div>{/if}
	{#if chevron}<Icon name="chevron-right" size={18} />{/if}
{/snippet}

{#if href}
	<a class="lr" {href} data-testid={testid}>{@render inner()}</a>
{:else if onclick}
	<button class="lr" {onclick} data-testid={testid}>{@render inner()}</button>
{:else}
	<div class="lr" data-testid={testid}>{@render inner()}</div>
{/if}

<style>
	.lr {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		width: 100%;
		text-align: left;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		padding: 0.85rem 1rem;
		color: var(--text);
		text-decoration: none;
		font: inherit;
	}
	a.lr,
	button.lr {
		cursor: pointer;
		transition:
			background var(--dur-fast) var(--ease),
			border-color var(--dur-fast) var(--ease);
	}
	a.lr:hover,
	button.lr:hover {
		background: var(--elevated);
		border-color: var(--border-strong);
	}
	.lr-main {
		flex: 1;
		min-width: 0;
	}
	.lr-title {
		font-weight: 600;
	}
	.lr-sub {
		font-size: 0.82rem;
		color: var(--muted);
		margin-top: 1px;
	}
	.lr-trail {
		flex-shrink: 0;
	}
	.lr :global(svg) {
		color: var(--faint);
		flex-shrink: 0;
	}
</style>
