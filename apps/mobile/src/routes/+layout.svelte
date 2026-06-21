<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { auth } from '$lib/stores/auth.svelte';

	let { children } = $props();

	const publicRoutes = ['/login', '/register'];

	onMount(() => {
		void auth.init();
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
	{#if auth.isAuthenticated}
		<nav class="nav">
			<div class="container nav-inner">
				<a class="brand" href="/">🪨 Granite</a>
				<div class="links">
					<a href="/">Today</a>
					<a href="/routines">Routines</a>
					<a href="/history">History</a>
					<a href="/exercises">Exercises</a>
					<button class="btn btn-ghost" onclick={logout}>Log out</button>
				</div>
			</div>
		</nav>
	{/if}
	{@render children()}
{/if}

<style>
	.nav {
		border-bottom: 1px solid var(--border);
		background: var(--surface);
	}
	.nav-inner {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding-top: 0.6rem;
		padding-bottom: 0.6rem;
	}
	.brand {
		font-weight: 700;
		text-decoration: none;
		color: var(--text);
	}
	.links {
		display: flex;
		align-items: center;
		gap: 1rem;
	}
	.links :global(.btn) {
		padding: 0.35rem 0.7rem;
	}
</style>
