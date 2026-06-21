<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon from './Icon.svelte';
	let {
		icon = 'exercises',
		title,
		description = undefined,
		action
	}: { icon?: string; title: string; description?: string; action?: Snippet } = $props();
</script>

<div class="empty">
	<div class="empty-icon"><Icon name={icon} size={28} /></div>
	<div class="empty-title">{title}</div>
	{#if description}<p class="empty-desc">{description}</p>{/if}
	{#if action}<div class="empty-action">{@render action()}</div>{/if}
</div>

<style>
	.empty {
		text-align: center;
		padding: 2.75rem 1rem;
	}
	.empty-icon {
		color: var(--faint);
		display: flex;
		justify-content: center;
		margin-bottom: 0.75rem;
	}
	.empty-title {
		font-weight: 600;
	}
	.empty-desc {
		color: var(--muted);
		font-size: 0.9rem;
		margin: 0.35rem 0 1.1rem;
	}
	.empty-action {
		display: flex;
		justify-content: center;
	}
</style>
