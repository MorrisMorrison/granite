<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { checkServer, connectMessage } from '#lib/connect.ts';
	import { getServerUrl, hasServerUrl, setServerUrl } from '#lib/config.ts';
	import { resetLocalData } from '#lib/sync/index.ts';
	import { auth } from '#lib/stores/auth.svelte.ts';
	import Button from '#lib/components/ui/Button.svelte';
	import favicon from '#lib/assets/favicon.svg';

	// Native only: the app isn't served by a Granite server, so it asks for one once.
	const previous = hasServerUrl() ? getServerUrl() : null;
	let address = $state(page.url.searchParams.get('change') && previous ? previous : '');
	let error = $state('');
	let busy = $state(false);

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		if (auth.isAuthenticated) {
			error = 'Sign out first to change server.';
			return;
		}
		busy = true;
		error = '';
		const result = await checkServer(address);
		busy = false;
		if (!result.ok) {
			error = connectMessage(result.reason, address);
			return;
		}
		// A different server's data must never mix with this one's.
		if (previous && previous !== result.url) await resetLocalData();
		setServerUrl(result.url);
		await goto('/login');
	}
</script>

<svelte:head><title>Connect · Granite</title></svelte:head>

<main class="auth">
	<div class="brand"><img class="logo" src={favicon} alt="" />Granite</div>
	<form class="card" onsubmit={submit} novalidate>
		<h2>Connect to your server</h2>
		<p class="muted lead">Enter the address of your Granite server.</p>
		<label for="server">Server address</label>
		<input
			id="server"
			type="url"
			inputmode="url"
			autocapitalize="none"
			autocomplete="url"
			placeholder="granite.example.com"
			bind:value={address}
			required
			data-testid="field-server-url"
		/>
		{#if error}<p class="error" data-testid="connect-error">{error}</p>{/if}
		<div class="submit">
			<Button type="submit" block disabled={busy} testid="btn-connect">
				{busy ? 'Checking…' : 'Connect'}
			</Button>
		</div>
	</form>
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
	.lead {
		margin: 0 0 1rem;
		text-align: center;
		font-size: 0.9rem;
	}
	.submit {
		margin-top: 1.1rem;
	}
</style>
