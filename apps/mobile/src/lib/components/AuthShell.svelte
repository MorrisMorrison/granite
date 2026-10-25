<script lang="ts">
	import type { Snippet } from 'svelte';
	import favicon from '#lib/assets/favicon.svg';

	// Shared layout for the signed-out screens (log in, register, connect): the Granite
	// mark, an eyebrow + large title + one-line subtitle, the form, then a quiet footer.
	let {
		eyebrow,
		title,
		subtitle = undefined,
		children,
		footer = undefined
	}: {
		eyebrow: string;
		title: string;
		subtitle?: string;
		children: Snippet;
		footer?: Snippet;
	} = $props();
</script>

<main class="auth">
	<div class="auth-brand"><img class="auth-logo" src={favicon} alt="" />Granite</div>
	<header class="auth-head">
		<p class="eyebrow">{eyebrow}</p>
		<h1 class="page-title auth-title">{title}</h1>
		{#if subtitle}<p class="auth-sub">{subtitle}</p>{/if}
	</header>
	{@render children()}
	{#if footer}<div class="auth-foot">{@render footer()}</div>{/if}
</main>

<style>
	.auth {
		max-width: 24rem;
		margin: 0 auto;
		padding: clamp(2rem, 9vh, 4.5rem) 1rem 2.5rem;
	}
	.auth-brand {
		display: flex;
		align-items: center;
		gap: 8px;
		font-weight: 600;
		font-size: 1.05rem;
		margin-bottom: clamp(1.75rem, 6vh, 3rem);
	}
	.auth-logo {
		width: 28px;
		height: 28px;
		display: block;
	}
	.auth-head {
		margin-bottom: 1.25rem;
	}
	.auth-title {
		font-size: 1.85rem;
	}
	.auth-sub {
		margin: 0.35rem 0 0;
		font-size: 0.95rem;
		color: var(--muted);
	}
	.auth-foot {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.4rem;
		margin-top: 1.25rem;
		text-align: center;
		font-size: 0.9rem;
		color: var(--muted);
	}
	/* Links down here are secondary: text-coloured, not accent blue. */
	.auth-foot :global(a) {
		color: var(--text);
		font-weight: 600;
	}
	.auth-foot :global(a:hover) {
		text-decoration: underline;
	}
	.auth-foot :global(p) {
		margin: 0;
	}
</style>
