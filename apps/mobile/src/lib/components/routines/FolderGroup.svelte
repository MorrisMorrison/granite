<script lang="ts">
	import type { Snippet } from 'svelte';
	import IconButton from '#lib/components/ui/IconButton.svelte';
	import Icon from '#lib/components/ui/Icon.svelte';
	import Sheet from '#lib/components/ui/Sheet.svelte';

	// A titled group of routines in one card. With `ontoggle` the name collapses the group;
	// with `onrename`/`ondelete` a ⋯ menu offers folder actions. Without any it's a plain
	// section label (the "Ungrouped" bucket).
	let {
		name,
		count = null,
		collapsed = false,
		empty = false,
		testid = undefined,
		ontoggle = undefined,
		onrename = undefined,
		ondelete = undefined,
		children
	}: {
		name: string;
		count?: number | null;
		collapsed?: boolean;
		empty?: boolean; // show the "Empty — move a routine here." hint instead of rows
		testid?: string;
		ontoggle?: () => void;
		onrename?: () => void;
		ondelete?: () => void;
		children: Snippet;
	} = $props();

	let menuOpen = $state(false);
	const hasMenu = $derived(!!onrename || !!ondelete);
</script>

<section class="folder" data-testid={testid}>
	{#if name}
		<div class="head">
			{#if ontoggle}
				<button class="toggle" onclick={ontoggle} aria-expanded={!collapsed} data-testid="folder-toggle">
					<span class="eyebrow">{name}</span>
					{#if count !== null}<span class="eyebrow n">{count}</span>{/if}
					<Icon name={collapsed ? 'chevron-right' : 'chevron-down'} size={14} />
				</button>
			{:else}
				<span class="eyebrow label">{name}</span>
			{/if}
			{#if hasMenu}
				<IconButton
					name="dots-vertical"
					label="Folder actions"
					onclick={() => (menuOpen = true)}
					testid="btn-folder-menu"
				/>
			{/if}
		</div>
	{/if}
	{#if !collapsed}
		<div class="group">
			{#if empty}
				<p class="empty">Empty — move a routine here.</p>
			{:else}
				{@render children()}
			{/if}
		</div>
	{/if}
</section>

{#if hasMenu}
	<Sheet open={menuOpen} title={name} onclose={() => (menuOpen = false)}>
		<ul class="mlist">
			{#if onrename}
				<li>
					<button
						class="mitem"
						onclick={() => {
							menuOpen = false;
							onrename?.();
						}}
					>
						<Icon name="edit" size={16} /> Rename folder
					</button>
				</li>
			{/if}
			{#if ondelete}
				<li>
					<button
						class="mitem"
						onclick={() => {
							menuOpen = false;
							ondelete?.();
						}}
					>
						<Icon name="trash" size={16} /> Delete folder
					</button>
				</li>
			{/if}
		</ul>
	</Sheet>
{/if}

<style>
	.folder {
		margin-bottom: 1.25rem;
	}
	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		margin-bottom: 0.4rem;
		min-height: 2rem;
	}
	.toggle {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		flex: 1;
		min-width: 0;
		background: none;
		border: none;
		color: var(--faint);
		cursor: pointer;
		font: inherit;
		padding: 0.2rem 0;
		text-align: left;
	}
	.eyebrow {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.eyebrow.n {
		font-variant-numeric: tabular-nums;
		opacity: 0.7;
	}
	.label {
		padding: 0.2rem 0;
	}
	.group {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		overflow: hidden;
	}
	/* Divider between the routine rows rendered into the card. */
	.group > :global(* + *) {
		border-top: 1px solid var(--border);
	}
	.empty {
		margin: 0;
		padding: 0.8rem 1.1rem;
		font-size: 0.85rem;
		color: var(--muted);
	}
	.mlist {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.mitem {
		width: 100%;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem 0.5rem;
		font: inherit;
		text-align: left;
		color: var(--text);
		background: none;
		border: none;
		border-bottom: 1px solid var(--border);
		cursor: pointer;
	}
	.mitem :global(svg) {
		color: var(--muted);
	}
</style>
