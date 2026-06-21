<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon from './Icon.svelte';

	let {
		open = false,
		title = '',
		onclose,
		children
	}: { open?: boolean; title?: string; onclose: () => void; children: Snippet } = $props();

	function onkeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onclose();
	}
</script>

<svelte:window {onkeydown} />

{#if open}
	<div class="overlay">
		<button class="backdrop" aria-label="Close" onclick={onclose}></button>
		<div class="sheet" role="dialog" aria-modal="true" tabindex="-1">
			<div class="sheet-head">
				<strong>{title}</strong>
				<button class="x" onclick={onclose} aria-label="Close"><Icon name="x" size={20} /></button>
			</div>
			<div class="sheet-body">{@render children()}</div>
		</div>
	</div>
{/if}

<style>
	.overlay {
		position: fixed;
		inset: 0;
		z-index: 100;
		display: flex;
		align-items: flex-end;
		justify-content: center;
	}
	.backdrop {
		position: absolute;
		inset: 0;
		background: rgba(0, 0, 0, 0.65);
		border: none;
		cursor: pointer;
	}
	.sheet {
		position: relative;
		z-index: 1;
		background: var(--surface);
		border: 1px solid var(--border-strong);
		border-bottom: none;
		border-radius: var(--radius-lg) var(--radius-lg) 0 0;
		width: 100%;
		max-width: var(--content-max);
		max-height: 85vh;
		display: flex;
		flex-direction: column;
		box-shadow: 0 -8px 40px rgba(0, 0, 0, 0.5);
		padding-bottom: env(safe-area-inset-bottom);
	}
	@media (min-width: 640px) {
		.overlay {
			align-items: center;
			padding: 1rem;
		}
		.sheet {
			border: 1px solid var(--border-strong);
			border-radius: var(--radius-lg);
			box-shadow: 0 12px 48px rgba(0, 0, 0, 0.55);
		}
	}
	.sheet-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.9rem 1.1rem;
		border-bottom: 1px solid var(--border);
	}
	.sheet-head strong {
		font-weight: 600;
	}
	.x {
		display: inline-flex;
		background: none;
		border: none;
		color: var(--muted);
		cursor: pointer;
		padding: 4px;
	}
	.sheet-body {
		min-height: 0;
		overflow-y: auto;
		padding: 0.5rem 1.1rem 1rem;
	}
</style>
