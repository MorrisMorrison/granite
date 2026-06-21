<script lang="ts">
	import type { Snippet } from 'svelte';
	let { title, action }: { title: string; action?: Snippet } = $props();
</script>

<div class="ph">
	<h1>{title}</h1>
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
	.ph h1 {
		margin: 0;
	}
	.ph-action {
		flex-shrink: 0;
	}
</style>
