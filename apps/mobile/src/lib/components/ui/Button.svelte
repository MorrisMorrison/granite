<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon from './Icon.svelte';

	type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';

	let {
		variant = 'primary',
		size = 'md',
		type = 'button',
		href = undefined,
		disabled = false,
		loading = false,
		block = false,
		icon = undefined,
		onclick = undefined,
		testid = undefined,
		children
	}: {
		variant?: Variant;
		size?: 'sm' | 'md';
		type?: 'button' | 'submit';
		href?: string;
		disabled?: boolean;
		loading?: boolean;
		block?: boolean;
		icon?: string;
		onclick?: (e: MouseEvent) => void;
		testid?: string;
		children: Snippet;
	} = $props();
</script>

{#if href}
	<a class="b v-{variant} s-{size}" class:block {href} data-testid={testid}>
		{#if icon}<Icon name={icon} size={size === 'sm' ? 16 : 18} />{/if}{@render children()}
	</a>
{:else}
	<button class="b v-{variant} s-{size}" class:block {type} {disabled} {onclick} data-testid={testid}>
		{#if icon}<Icon name={icon} size={size === 'sm' ? 16 : 18} />{/if}{@render children()}
	</button>
{/if}

<style>
	.b {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.45rem;
		font: inherit;
		font-weight: 600;
		border-radius: var(--radius-md);
		border: 1px solid transparent;
		cursor: pointer;
		text-decoration: none;
		white-space: nowrap;
		transition:
			background var(--dur-fast) var(--ease),
			border-color var(--dur-fast) var(--ease),
			transform var(--dur-fast) var(--ease);
	}
	.b:active {
		transform: scale(0.98);
	}
	.b:disabled {
		opacity: 0.55;
		cursor: default;
		transform: none;
	}
	.s-md {
		padding: 0.7rem 1.1rem;
		font-size: 0.95rem;
	}
	.s-sm {
		padding: 0.45rem 0.8rem;
		font-size: 0.85rem;
	}
	.block {
		width: 100%;
	}
	.v-primary {
		background: var(--accent);
		color: var(--accent-text);
	}
	.v-primary:hover {
		background: var(--accent-hover);
	}
	.v-secondary {
		background: var(--elevated);
		color: var(--text);
		border-color: var(--border);
	}
	.v-secondary:hover {
		background: var(--surface);
	}
	.v-outline {
		background: transparent;
		color: var(--text);
		border-color: var(--border-strong);
	}
	.v-outline:hover {
		background: var(--elevated);
	}
	.v-ghost {
		background: transparent;
		color: var(--muted);
	}
	.v-ghost:hover {
		background: var(--elevated);
		color: var(--text);
	}
	.v-destructive {
		background: var(--danger);
		color: #fff;
	}
</style>
