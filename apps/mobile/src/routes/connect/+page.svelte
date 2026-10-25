<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { checkServer, connectMessage } from '#lib/connect.ts';
	import { getServerUrl, hasServerUrl, setServerUrl } from '#lib/config.ts';
	import { resetLocalData } from '#lib/sync/index.ts';
	import { auth } from '#lib/stores/auth.svelte.ts';
	import Button from '#lib/components/ui/Button.svelte';
	import AuthShell from '#lib/components/AuthShell.svelte';
	import FormError from '#lib/components/ui/FormError.svelte';

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

<AuthShell eyebrow="Setup" title="Connect to your server" subtitle="Enter the address of your Granite server.">
	<form class="card form" onsubmit={submit} novalidate>
		<label class="field" for="server">
			<span class="eyebrow">Server address</span>
			<input
				id="server"
				class="control"
				type="url"
				inputmode="url"
				autocapitalize="none"
				autocomplete="url"
				placeholder="granite.example.com"
				bind:value={address}
				required
				data-testid="field-server-url"
			/>
		</label>
		<FormError message={error} testid="connect-error" />
		<Button type="submit" block disabled={busy} testid="btn-connect">
			{busy ? 'Checking…' : 'Connect'}
		</Button>
	</form>
</AuthShell>
