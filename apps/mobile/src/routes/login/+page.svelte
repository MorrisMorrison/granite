<script lang="ts">
	import { goto } from '$app/navigation';
	import { auth } from '$lib/stores/auth.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import favicon from '$lib/assets/favicon.svg';

	let email = $state('');
	let password = $state('');
	let error = $state('');
	let busy = $state(false);

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		busy = true;
		error = '';
		try {
			await auth.login(email, password);
			await goto('/');
		} catch (err) {
			error = (err as Error).message;
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head><title>Log in · Granite</title></svelte:head>

<main class="auth">
	<div class="brand"><img class="logo" src={favicon} alt="" />Granite</div>
	<form class="card" onsubmit={submit}>
		<h2>Log in</h2>
		<label for="email">Email</label>
		<input id="email" type="email" bind:value={email} autocomplete="username" required data-testid="field-email" />
		<label for="password">Password</label>
		<input
			id="password"
			type="password"
			bind:value={password}
			autocomplete="current-password"
			required
			data-testid="field-password"
		/>
		{#if error}<p class="error">{error}</p>{/if}
		<div class="submit">
			<Button type="submit" block disabled={busy} testid="btn-login">
				{busy ? 'Logging in…' : 'Log in'}
			</Button>
		</div>
	</form>
	<p class="muted alt">No account? <a href="/register">Register</a></p>
</main>

<style>
	.auth {
		max-width: 22rem;
		margin: 0 auto;
		padding: 4rem 1rem 2rem;
	}
	.brand {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		font-weight: 600;
		font-size: 1.15rem;
		margin-bottom: 1.25rem;
	}
	.logo {
		width: 28px;
		height: 28px;
		display: block;
	}
	.card h2 {
		margin: 0 0 0.25rem;
		font-size: 1.1rem;
		font-weight: 600;
		text-align: center;
	}
	.submit {
		margin-top: 1.1rem;
	}
	.alt {
		text-align: center;
		margin-top: 1rem;
	}
</style>
