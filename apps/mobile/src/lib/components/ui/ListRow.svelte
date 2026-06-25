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

<div class="lr" class:interactive={href || onclick}>
	{#if href}
		<a class="lr-main stretch" {href} data-testid={testid}>
			<span class="lr-title">{title}</span>
			{#if subtitle}<span class="lr-sub">{subtitle}</span>{/if}
		</a>
	{:else if onclick}
		<button class="lr-main stretch" {onclick} data-testid={testid}>
			<span class="lr-title">{title}</span>
			{#if subtitle}<span class="lr-sub">{subtitle}</span>{/if}
		</button>
	{:else}
		<div class="lr-main" data-testid={testid}>
			<span class="lr-title">{title}</span>
			{#if subtitle}<span class="lr-sub">{subtitle}</span>{/if}
		</div>
	{/if}
	{#if trailing}<div class="lr-trail">{@render trailing()}</div>{/if}
	{#if chevron}<span class="lr-chev"><Icon name="chevron-right" size={18} /></span>{/if}
</div>

<style>
	.lr {
		position: relative;
		display: flex;
		align-items: center;
		gap: 0.75rem;
		width: 100%;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		padding: 0.85rem 1rem;
		color: var(--text);
	}
	.lr.interactive {
		transition:
			background var(--dur-fast) var(--ease),
			border-color var(--dur-fast) var(--ease);
	}
	.lr.interactive:hover {
		background: var(--elevated);
		border-color: var(--border-strong);
	}
	.lr-main {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		text-align: left;
		background: transparent;
		border: none;
		color: inherit;
		font: inherit;
		padding: 0;
		text-decoration: none;
	}
	/* The whole row navigates (stretched hit area); trailing actions stay
	   independently clickable above it. */
	.stretch {
		cursor: pointer;
	}
	.stretch::after {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: inherit;
	}
	.lr-title {
		font-weight: 600;
	}
	.lr-sub {
		font-size: 0.82rem;
		color: var(--muted);
		margin-top: 1px;
	}
	.lr-trail,
	.lr-chev {
		position: relative;
		z-index: 1;
		flex-shrink: 0;
	}
	.lr :global(svg) {
		flex-shrink: 0;
	}
	.lr-chev :global(svg) {
		color: var(--faint);
	}
</style>
