<script lang="ts">
	import { SET_TYPES, SET_TYPE_LABEL, type SetType } from '#lib/sets.ts';
	import Icon from '#lib/components/ui/Icon.svelte';
	import Sheet from '#lib/components/ui/Sheet.svelte';

	// The sheet behind a set badge (logger + routine editor): pick the set type, or
	// delete the set. Closes itself via the callers' handlers.
	let {
		open = false,
		type = 'normal',
		onpick,
		ondelete,
		onclose
	}: {
		open?: boolean;
		type?: string; // the set's current set_type
		onpick: (t: SetType) => void;
		ondelete: () => void;
		onclose: () => void;
	} = $props();
</script>

<Sheet {open} title="Set type" {onclose}>
	<ul class="menu">
		{#each SET_TYPES as t (t)}
			<li>
				<button
					class="menu-item"
					class:on={type === t}
					data-testid={`set-type-${t}`}
					onclick={() => onpick(t)}
				>
					{SET_TYPE_LABEL[t]}
					{#if type === t}<span class="menu-tick"><Icon name="check" size={16} /></span>{/if}
				</button>
			</li>
		{/each}
		<li>
			<button class="menu-item danger" data-testid="btn-delete-set" onclick={ondelete}>
				<Icon name="trash" size={16} /> Delete set
			</button>
		</li>
	</ul>
</Sheet>
