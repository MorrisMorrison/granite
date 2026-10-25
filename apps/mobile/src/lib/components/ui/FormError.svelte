<script lang="ts">
	import Icon from './Icon.svelte';

	// Inline form/action error: danger text with an icon, announced to screen readers.
	// Renders nothing while `message` is empty, so callers can pass their error state as is.
	let { message = '', testid = undefined }: { message?: string; testid?: string } = $props();
</script>

{#if message}
	<p class="form-error" role="alert" data-testid={testid}><Icon name="alert" size={16} /><span>{message}</span></p>
{/if}

<style>
	.form-error {
		display: flex;
		align-items: flex-start;
		gap: 0.45rem;
		margin: 0;
		font-size: 0.875rem;
		line-height: 1.4;
		color: var(--danger);
	}
	.form-error :global(svg) {
		flex-shrink: 0;
		margin-top: 0.1rem;
	}
</style>
