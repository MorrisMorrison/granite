<script lang="ts">
	import type { Snippet } from 'svelte';
	let { variant = 'muted', children }: { variant?: 'muted' | 'accent'; children: Snippet } = $props();
</script>

<span class="badge v-{variant}">{@render children()}</span>

<style>
	.badge {
		display: inline-flex;
		align-items: center;
		font-size: 0.68rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		padding: 0.15rem 0.5rem;
		border-radius: var(--radius-pill);
		border: 1px solid var(--border);
	}
	.v-muted {
		color: var(--muted);
	}
	.v-accent {
		color: var(--accent);
		border-color: var(--accent-subtle);
		background: var(--accent-subtle);
	}
</style>
