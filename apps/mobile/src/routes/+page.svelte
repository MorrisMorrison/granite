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
		<a class="btn" href="/log" style="width:100%; padding:0.9rem;">Start workout</a>
		<p class="muted" style="margin-top:0.75rem; margin-bottom:0;">
			Review past sessions in <a href="/history">History</a>, or browse the
			<a href="/exercises">exercise library</a>.
		</p>
	</div>
</main>
