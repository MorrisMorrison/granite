<script lang="ts">
	import type { Snippet } from 'svelte';
	let {
		title,
		eyebrow = undefined,
		subtitle = undefined,
		action
	}: { title: string; eyebrow?: string; subtitle?: string; action?: Snippet } = $props();
</script>

<div class="ph" class:has-eyebrow={!!eyebrow}>
	<div class="ph-titles">
		{#if eyebrow}<p class="eyebrow ph-eyebrow" data-testid="page-eyebrow">{eyebrow}</p>{/if}
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
	/* With an eyebrow the header reads like Today's: label above a heavier title,
	   and the action lines up with the title rather than the block's middle. */
	.ph.has-eyebrow {
		align-items: flex-end;
		margin-bottom: 1.1rem;
	}
	.ph.has-eyebrow h1 {
		margin-top: 0.2rem;
		font-size: 1.6rem;
		font-weight: 650;
		letter-spacing: -0.02em;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.ph-eyebrow {
		font-variant-numeric: tabular-nums;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
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
