<script lang="ts">
	import { auth } from '$lib/stores/auth.svelte';
</script>

<svelte:head><title>Granite</title></svelte:head>

<main class="container">
	<h1>Today</h1>
	{#if auth.user}
		<p class="muted">Signed in as {auth.user.email}</p>
	{/if}
	<div class="card">
		<p>Welcome to Granite. Your workout logger is taking shape.</p>
		<p class="muted">Next up: routines and the workout logger. For now, browse your
			<a href="/exercises">exercises</a>.</p>
	</div>
</main>
