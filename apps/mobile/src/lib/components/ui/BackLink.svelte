<script lang="ts">
	import Icon from './Icon.svelte';
	let { href, label = 'Back' }: { href: string; label?: string } = $props();
</script>

<a class="back" {href}><Icon name="arrow-left" size={16} />{label}</a>

<style>
	.back {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		color: var(--muted);
		text-decoration: none;
		font-size: 0.85rem;
		margin-bottom: 0.75rem;
	}
	.back:hover {
		color: var(--text);
	}
	.back :global(svg) {
		color: inherit;
	}
</style>
