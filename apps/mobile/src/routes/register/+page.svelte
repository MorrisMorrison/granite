<script lang="ts">
	import { goto } from '$app/navigation';
	import { auth } from '$lib/stores/auth.svelte';

	let email = $state('');
	let password = $state('');
	let error = $state('');
	let busy = $state(false);

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		busy = true;
		error = '';
		try {
			await auth.register(email, password);
			await goto('/');
		} catch (err) {
			error = (err as Error).message;
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head><title>Register · Granite</title></svelte:head>

<main class="container" style="max-width: 24rem; margin-top: 4rem;">
	<h1>🪨 Granite</h1>
	<form class="card" onsubmit={submit}>
		<h2 style="margin-top:0">Create account</h2>
		<label for="email">Email</label>
		<input id="email" type="email" bind:value={email} autocomplete="username" required />
		<label for="password">Password</label>
		<input
			id="password"
			type="password"
			bind:value={password}
			autocomplete="new-password"
			minlength="8"
			required
		/>
		<p class="muted" style="font-size:0.8rem">At least 8 characters.</p>
		{#if error}<p class="error">{error}</p>{/if}
		<button class="btn" type="submit" disabled={busy} style="width:100%; margin-top:1rem;">
			{busy ? 'Creating…' : 'Create account'}
		</button>
	</form>
	<p class="muted" style="text-align:center">Have an account? <a href="/login">Log in</a></p>
</main>
