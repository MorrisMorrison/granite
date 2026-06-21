<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { onMount } from 'svelte';
	import { goto, preloadCode } from '$app/navigation';
	import { page } from '$app/state';
	import { auth } from '$lib/stores/auth.svelte';
	import TabBar from '$lib/components/ui/TabBar.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';

	let { children } = $props();

	const publicRoutes = ['/login', '/register'];

	onMount(() => {
		void auth.init();
		// Warm every screen's code while online so each route works offline on first
		// visit (the service worker caches what's fetched). Best-effort.
		for (const path of [
			'/',
			'/login',
			'/register',
			'/log',
			'/routines',
			'/routines/new',
			'/routines/_',
			'/exercises',
			'/history'
		]) {
			void preloadCode(path).catch(() => {});
		}
	});

	$effect(() => {
		if (!auth.ready) return;
		const isPublic = publicRoutes.includes(page.url.pathname);
		if (!auth.isAuthenticated && !isPublic) void goto('/login');
		if (auth.isAuthenticated && isPublic) void goto('/');
	});

	async function logout() {
		await auth.logout();
		await goto('/login');
	}
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{#if !auth.ready}
	<div class="container"><p class="muted">Loading…</p></div>
{:else}
	{#if auth.isAuthenticated && page.url.pathname !== '/log'}
		<header class="appbar">
			<div class="appbar-inner">
				<a class="brand" href="/"><span class="logo"></span>Granite</a>
				<button class="iconbtn" onclick={logout} aria-label="Log out" data-testid="btn-logout">
					<Icon name="logout" size={20} />
				</button>
			</div>
		</header>
	{/if}
	{@render children()}
	{#if auth.isAuthenticated && page.url.pathname !== '/log'}
		<TabBar />
	{/if}
{/if}

<style>
	.appbar {
		position: sticky;
		top: 0;
		background: color-mix(in srgb, var(--bg) 85%, transparent);
		backdrop-filter: blur(10px);
		border-bottom: 1px solid var(--border);
		z-index: 40;
	}
	.appbar-inner {
		max-width: var(--content-max);
		margin: 0 auto;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.65rem 1rem;
	}
	.brand {
		display: flex;
		align-items: center;
		gap: 8px;
		font-weight: 600;
		text-decoration: none;
		color: var(--text);
	}
	.logo {
		width: 18px;
		height: 18px;
		border-radius: 5px;
		background: var(--accent);
	}
	.iconbtn {
		display: inline-flex;
		background: transparent;
		border: none;
		color: var(--muted);
		padding: 6px;
		border-radius: var(--radius-md);
		cursor: pointer;
	}
	.iconbtn:hover {
		background: var(--elevated);
		color: var(--text);
	}
</style>
