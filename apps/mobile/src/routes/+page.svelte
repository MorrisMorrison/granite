<script lang="ts">
	import { APP_NAME } from '$lib';
</script>

<svelte:head>
	<title>{APP_NAME}</title>
</svelte:head>

<main>
	<h1>🪨 {APP_NAME}</h1>
	<p>Open-source, self-hostable, offline-first workout tracker.</p>
	<p>Scaffold is up — building from here.</p>
</main>

<style>
	main {
		font-family: system-ui, sans-serif;
		max-width: 40rem;
		margin: 4rem auto;
		padding: 0 1rem;
		line-height: 1.6;
	}
</style>
