<script lang="ts">
	import '../app.css';
	import favicon from '#lib/assets/favicon.svg';
	import { onMount } from 'svelte';
	import { goto, preloadCode } from '$app/navigation';
	import { page } from '$app/state';
	import { routes } from '$app/manifest';
	import { auth } from '#lib/stores/auth.svelte.ts';
	import { isNative } from '#lib/platform/native.ts';
	import { hasServerUrl } from '#lib/config.ts';
	import { install } from '#lib/stores/install.svelte.ts';
	import { offersButton } from '#lib/install.ts';
	import InstallSheet from '#lib/components/InstallSheet.svelte';
	import TabBar from '#lib/components/ui/TabBar.svelte';
	import Icon from '#lib/components/ui/Icon.svelte';

	let { children } = $props();

	const publicRoutes = ['/login', '/register', '/connect'];

	onMount(() => {
		void auth.init();
		install.init();
		// Warm every screen's code while online so each route works offline on first
		// visit (the service worker caches what's fetched). Best-effort.
		for (const route of routes) {
			if (route.page) void preloadCode(route.id).catch(() => {});
		}
	});

	$effect(() => {
		if (!auth.ready) return;
		const path = page.url.pathname;
		// The native app needs a server before anything else.
		if (isNative() && !hasServerUrl()) {
			if (path !== '/connect') void goto('/connect');
			return;
		}
		// /connect is native-only; the web app is served by its server.
		if (path === '/connect' && !isNative()) {
			void goto('/login');
			return;
		}
		const isPublic = publicRoutes.includes(path);
		if (!auth.isAuthenticated && !isPublic) void goto('/login');
		if (auth.isAuthenticated && isPublic && path !== '/connect') void goto('/');
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
				<a class="brand" href="/"><img class="logo" src={favicon} alt="" />Granite</a>
				<div class="appbar-actions">
					{#if offersButton(install)}
						<button
							class="iconbtn"
							onclick={() => install.install()}
							aria-label="Add to Home Screen"
							title="Add to Home Screen"
							data-testid="btn-install"
						>
							<Icon name="download" size={20} />
						</button>
					{/if}
					<a class="iconbtn" href="/exercises" aria-label="Exercise library" data-testid="nav-exercises">
						<Icon name="exercises" size={20} />
					</a>
					<a class="iconbtn" href="/tools" aria-label="Calculators" data-testid="nav-tools">
						<Icon name="calculator" size={20} />
					</a>
					<a class="iconbtn" href="/settings" aria-label="Settings" data-testid="nav-settings">
						<Icon name="settings" size={20} />
					</a>
					<button class="iconbtn" onclick={logout} aria-label="Log out" data-testid="btn-logout">
						<Icon name="logout" size={20} />
					</button>
				</div>
			</div>
		</header>
	{/if}
	{@render children()}
	{#if auth.isAuthenticated && page.url.pathname !== '/log'}
		<TabBar />
	{/if}
	<InstallSheet />
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
	.appbar-actions {
		display: flex;
		align-items: center;
		gap: 0.1rem;
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
		width: 28px;
		height: 28px;
		display: block;
	}
	/* Same 36px hit area for every icon, link or button. */
	.iconbtn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		height: 36px;
		background: transparent;
		border: none;
		color: var(--muted);
		padding: 0;
		border-radius: var(--radius-md);
		cursor: pointer;
	}
	.iconbtn:hover {
		background: var(--elevated);
		color: var(--text);
	}
</style>
