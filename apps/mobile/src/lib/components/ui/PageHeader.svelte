<script lang="ts">
	import type { Snippet } from 'svelte';
	let {
		title,
		subtitle = undefined,
		action
	}: { title: string; subtitle?: string; action?: Snippet } = $props();
</script>

<div class="ph">
	<div class="ph-titles">
		<h1>{title}</h1>
		{#if subtitle}<p class="ph-sub">{subtitle}</p>{/if}
	</div>
	{#if action}<div class="ph-action">{@render action()}</div>{/if}
</div>

<style>
	.ph {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 1rem;
	}
	.ph-titles {
		min-width: 0;
	}
	.ph h1 {
		margin: 0;
	}
	.ph-sub {
		margin: 0.15rem 0 0;
		font-size: 0.9rem;
		color: var(--muted);
	}
	.ph-action {
		flex-shrink: 0;
	}
</style>
