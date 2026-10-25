<script lang="ts">
	import { goto } from '$app/navigation';
	import { auth } from '#lib/stores/auth.svelte.ts';
	import Button from '#lib/components/ui/Button.svelte';
	import ServerLine from '#lib/components/ServerLine.svelte';
	import AuthShell from '#lib/components/AuthShell.svelte';
	import FormError from '#lib/components/ui/FormError.svelte';

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

<AuthShell eyebrow="Register" title="Create your account" subtitle="One account, synced across your devices.">
	<form class="card form" onsubmit={submit}>
		<label class="field" for="email">
			<span class="eyebrow">Email</span>
			<input
				id="email"
				class="control"
				type="email"
				bind:value={email}
				autocomplete="username"
				required
				data-testid="field-email"
			/>
		</label>
		<label class="field" for="password">
			<span class="eyebrow">Password</span>
			<input
				id="password"
				class="control"
				type="password"
				bind:value={password}
				autocomplete="new-password"
				minlength="8"
				required
				aria-describedby="password-hint"
				data-testid="field-password"
			/>
			<span class="field-hint" id="password-hint">At least 8 characters.</span>
		</label>
		<FormError message={error} testid="auth-error" />
		<Button type="submit" block disabled={busy} testid="btn-register">
			{busy ? 'Creating…' : 'Create account'}
		</Button>
	</form>
	{#snippet footer()}
		<p>Have an account? <a href="/login">Log in</a></p>
		<ServerLine />
	{/snippet}
</AuthShell>
