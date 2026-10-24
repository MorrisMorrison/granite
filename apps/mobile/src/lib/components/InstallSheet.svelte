<script lang="ts">
	import { sheetSteps } from '#lib/install.ts';
	import { install } from '#lib/stores/install.svelte.ts';
	import Sheet from '#lib/components/ui/Sheet.svelte';
	import Button from '#lib/components/ui/Button.svelte';

	// How to add Granite to the home screen, for browsers without an install prompt.
	let copied = $state(false);

	async function copyLink() {
		try {
			await navigator.clipboard.writeText(location.origin + '/');
			copied = true;
		} catch {
			/* clipboard blocked — the steps still say how */
		}
	}
</script>

<Sheet open={install.sheetOpen} title="Add Granite to your Home Screen" onclose={() => (install.sheetOpen = false)}>
	<ol class="steps" data-testid="install-steps">
		{#each sheetSteps(install.platform) as step}
			<li>{@html step}</li>
		{/each}
	</ol>
	{#if install.platform === 'inapp'}
		<Button variant="outline" block onclick={copyLink} testid="btn-install-copy">
			{copied ? 'Link copied' : 'Copy link'}
		</Button>
	{/if}
</Sheet>

<style>
	.steps {
		margin: 0.25rem 0 1rem;
		padding-left: 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		line-height: 1.45;
	}
	.steps :global(.share-icon) {
		width: 1em;
		height: 1em;
		vertical-align: -0.12em;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.5;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
</style>
