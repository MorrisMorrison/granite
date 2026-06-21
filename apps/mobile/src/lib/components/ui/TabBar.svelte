<script lang="ts">
	import { page } from '$app/state';
	import Icon from './Icon.svelte';

	const tabs = [
		{ href: '/', label: 'Today', icon: 'home', testid: 'nav-tab-today' },
		{ href: '/routines', label: 'Routines', icon: 'routines', testid: 'nav-tab-routines' },
		{ href: '/history', label: 'History', icon: 'history', testid: 'nav-tab-history' },
		{ href: '/exercises', label: 'Exercises', icon: 'exercises', testid: 'nav-tab-exercises' }
	];

	function active(href: string): boolean {
		const p = page.url.pathname;
		return href === '/' ? p === '/' : p.startsWith(href);
	}
</script>

<nav class="tabbar" aria-label="Primary">
	<div class="inner">
		{#each tabs as t (t.href)}
			<a
				class="tab"
				class:active={active(t.href)}
				href={t.href}
				data-testid={t.testid}
				aria-current={active(t.href) ? 'page' : undefined}
			>
				<Icon name={t.icon} size={22} />
				<span>{t.label}</span>
			</a>
		{/each}
	</div>
</nav>

<style>
	.tabbar {
		position: fixed;
		left: 0;
		right: 0;
		bottom: 0;
		background: var(--surface);
		border-top: 1px solid var(--border);
		padding-bottom: env(safe-area-inset-bottom);
		z-index: 50;
	}
	.inner {
		max-width: var(--content-max);
		margin: 0 auto;
		display: flex;
	}
	.tab {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 3px;
		padding: 9px 0 8px;
		color: var(--muted);
		font-size: 0.68rem;
		text-decoration: none;
		transition: color var(--dur-fast) var(--ease);
	}
	.tab.active {
		color: var(--accent);
	}
</style>
