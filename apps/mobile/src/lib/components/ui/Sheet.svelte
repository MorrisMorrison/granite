<script lang="ts">
	import type { Snippet } from 'svelte';
	import { tick } from 'svelte';
	import Icon from './Icon.svelte';

	let {
		open = false,
		title = '',
		onclose,
		children
	}: { open?: boolean; title?: string; onclose: () => void; children: Snippet } = $props();

	let dialogEl = $state<HTMLElement | undefined>();
	let lastFocused: HTMLElement | null = null;

	// Move focus into the dialog on open; restore it to the trigger on close.
	$effect(() => {
		if (open) {
			lastFocused = (document.activeElement as HTMLElement) ?? null;
			void tick().then(() => dialogEl?.focus());
		} else if (lastFocused) {
			lastFocused.focus();
			lastFocused = null;
		}
	});

	const FOCUSABLE =
		'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

	function onkeydown(e: KeyboardEvent) {
		if (!open) return;
		if (e.key === 'Escape') {
			onclose();
			return;
		}
		if (e.key !== 'Tab' || !dialogEl) return;
		// Trap Tab within the dialog.
		const f = Array.from(dialogEl.querySelectorAll<HTMLElement>(FOCUSABLE));
		if (f.length === 0) {
			e.preventDefault();
			dialogEl.focus();
			return;
		}
		const first = f[0];
		const last = f[f.length - 1];
		const active = document.activeElement;
		if (e.shiftKey && (active === first || active === dialogEl)) {
			e.preventDefault();
			last.focus();
		} else if (!e.shiftKey && active === last) {
			e.preventDefault();
			first.focus();
		}
	}
</script>

<svelte:window {onkeydown} />

{#if open}
	<div class="overlay">
		<button class="backdrop" aria-label="Close" onclick={onclose}></button>
		<div class="sheet" role="dialog" aria-modal="true" tabindex="-1" bind:this={dialogEl}>
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
