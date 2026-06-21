<script lang="ts">
	import { onMount } from 'svelte';
	import { auth } from '$lib/stores/auth.svelte';
	import { prefs } from '$lib/stores/prefs.svelte';
	import { api } from '$lib/api/client';
	import { getServerUrl } from '$lib/config';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';

	interface TokenRow {
		id: string;
		name: string;
		prefix: string;
		scopes: string[] | null;
		created_at: number;
		last_used_at: number | null;
	}

	let tokens = $state<TokenRow[]>([]);
	let tokensLoading = $state(true);
	let tokensError = $state('');

	let createSheet = $state<{ open: boolean; name: string; write: boolean }>({
		open: false,
		name: '',
		write: false
	});
	let creating = $state(false);
	let newToken = $state<string | null>(null);
	let copied = $state(false);

	let exporting = $state(false);
	let exportError = $state('');

	async function loadTokens() {
		tokensLoading = true;
		tokensError = '';
		const { data, error } = await api().GET('/api/v1/tokens');
		if (error) tokensError = 'Could not load tokens — are you online?';
		else tokens = (data?.tokens ?? []) as TokenRow[];
		tokensLoading = false;
	}
	onMount(loadTokens);

	function isWrite(t: TokenRow): boolean {
		return (t.scopes ?? []).includes('write');
	}

	async function createToken() {
		const name = createSheet.name.trim();
		if (!name) return;
		creating = true;
		tokensError = '';
		const body = createSheet.write ? { name, scopes: ['write'] } : { name };
		const { data, error } = await api().POST('/api/v1/tokens', { body });
		creating = false;
		if (error || !data) {
			tokensError = 'Could not create token.';
			return;
		}
		createSheet = { open: false, name: '', write: false };
		newToken = data.token ?? null;
		copied = false;
		await loadTokens();
	}

	async function copyToken() {
		if (!newToken) return;
		try {
			await navigator.clipboard.writeText(newToken);
			copied = true;
		} catch {
			/* clipboard blocked — user can select manually */
		}
	}

	async function revoke(t: TokenRow) {
		if (!confirm(`Revoke "${t.name}"? Anything using it stops working.`)) return;
		tokensError = '';
		const { error } = await api().DELETE('/api/v1/tokens/{id}', { params: { path: { id: t.id } } });
		if (error) {
			tokensError = 'Could not revoke token.';
			return;
		}
		await loadTokens();
	}

	async function exportData() {
		exporting = true;
		exportError = '';
		const { data, error } = await api().GET('/api/v1/export');
		exporting = false;
		if (error || !data) {
			exportError = 'Export failed — are you online?';
			return;
		}
		const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `granite-export-${new Date().toISOString().slice(0, 10)}.json`;
		a.click();
		URL.revokeObjectURL(url);
	}

	function fmtDate(ms: number): string {
		return new Date(ms).toLocaleDateString(undefined, {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	}
</script>

<svelte:head><title>Settings · Granite</title></svelte:head>

<main class="container">
	<PageHeader title="Settings" />

	<section class="block">
		<h2>Account</h2>
		<div class="card">
			<div class="row">
				<span class="muted">Email</span>
				<span data-testid="settings-email">{auth.user?.email ?? '—'}</span>
			</div>
			<div class="row">
				<span class="muted">Server</span>
				<span class="mono">{getServerUrl()}</span>
			</div>
		</div>
	</section>

	<section class="block">
		<h2>Preferences</h2>
		<div class="card">
			<div class="row">
				<label class="muted" for="pref-unit">Weight unit</label>
				<select
					id="pref-unit"
					class="control"
					value={prefs.current.weightUnit}
					onchange={(e) => prefs.update({ weightUnit: e.currentTarget.value as 'kg' | 'lb' })}
					data-testid="field-weight-unit"
				>
					<option value="kg">kg</option>
					<option value="lb">lb</option>
				</select>
			</div>
			<div class="row">
				<label class="muted" for="pref-rest">Default rest (seconds)</label>
				<input
					id="pref-rest"
					class="control"
					type="number"
					inputmode="numeric"
					min="0"
					value={prefs.current.restSeconds}
					onchange={(e) => prefs.update({ restSeconds: Math.max(0, Number(e.currentTarget.value) || 0) })}
					data-testid="field-rest-seconds"
				/>
			</div>
		</div>
	</section>

	<section class="block">
		<h2>Your data</h2>
		<div class="card">
			<p class="muted desc">Download everything — routines, workouts, exercises — as a JSON file.</p>
			{#if exportError}<p class="error">{exportError}</p>{/if}
			<div class="actions">
				<Button variant="outline" onclick={exportData} disabled={exporting} testid="btn-export">
					{exporting ? 'Exporting…' : 'Export JSON'}
				</Button>
			</div>
		</div>
	</section>

	<section class="block">
		<div class="block-head">
			<h2>API tokens</h2>
			<Button
				size="sm"
				icon="plus"
				onclick={() => (createSheet = { open: true, name: '', write: false })}
				testid="btn-new-token"
			>
				New
			</Button>
		</div>
		<p class="muted desc">
			Personal tokens for scripts and integrations. Read-only by default; grant write to log
			workouts or edit routines.
		</p>
		{#if tokensError}<p class="error">{tokensError}</p>{/if}

		{#if tokensLoading}
			<p class="muted">Loading…</p>
		{:else if tokens.length === 0}
			<div class="card"><p class="muted" style="margin:0">No tokens yet.</p></div>
		{:else}
			<div class="list">
				{#each tokens as t (t.id)}
					<div class="token card" data-testid="token-row">
						<div class="token-main">
							<div class="token-name">
								{t.name}
								<Badge variant={isWrite(t) ? 'accent' : 'muted'}>
									{isWrite(t) ? 'read+write' : 'read'}
								</Badge>
							</div>
							<div class="muted token-meta">
								<span class="mono">{t.prefix}…</span> · created {fmtDate(t.created_at)}
								{#if t.last_used_at}· last used {fmtDate(t.last_used_at)}{:else}· never used{/if}
							</div>
						</div>
						<button class="ic" onclick={() => revoke(t)} aria-label="Revoke token" data-testid="btn-revoke-token">
							<Icon name="trash" size={16} />
						</button>
					</div>
				{/each}
			</div>
		{/if}
	</section>
</main>

<!-- Create token -->
<Sheet
	open={createSheet.open}
	title="New API token"
	onclose={() => (createSheet = { open: false, name: '', write: false })}
>
	<label class="field-label" for="token-name">Name</label>
	<input
		id="token-name"
		class="full"
		placeholder="e.g. My script"
		bind:value={createSheet.name}
		data-testid="field-token-name"
	/>
	<label class="checkrow">
		<input type="checkbox" bind:checked={createSheet.write} data-testid="field-token-write" />
		Allow write access (log workouts, edit routines)
	</label>
	<Button block onclick={createToken} disabled={creating || !createSheet.name.trim()} testid="btn-create-token">
		{creating ? 'Creating…' : 'Create token'}
	</Button>
</Sheet>

<!-- Token created — shown once -->
<Sheet open={newToken !== null} title="Token created" onclose={() => (newToken = null)}>
	<p class="muted desc">Copy it now — for security it won't be shown again.</p>
	<div class="token-value mono" data-testid="new-token-value">{newToken}</div>
	<Button block onclick={copyToken} icon={copied ? 'check' : undefined} testid="btn-copy-token">
		{copied ? 'Copied' : 'Copy to clipboard'}
	</Button>
</Sheet>

<style>
	.block {
		margin-bottom: 1.75rem;
	}
	.block-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 0.6rem;
	}
	h2 {
		font-size: 0.95rem;
		font-weight: 600;
		margin: 0 0 0.6rem;
	}
	.block-head h2 {
		margin: 0;
	}
	.desc {
		font-size: 0.85rem;
		margin: 0 0 0.75rem;
	}
	.row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.35rem 0;
	}
	.control {
		width: 7rem;
		text-align: right;
	}
	.actions {
		margin-top: 0.85rem;
	}
	.list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.token {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.85rem 1rem;
	}
	.token-main {
		flex: 1;
		min-width: 0;
	}
	.token-name {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-weight: 600;
	}
	.token-meta {
		font-size: 0.8rem;
		margin-top: 2px;
	}
	.ic {
		display: inline-flex;
		background: none;
		border: none;
		color: var(--muted);
		cursor: pointer;
		padding: 6px;
		border-radius: var(--radius-md);
		flex-shrink: 0;
	}
	.ic:hover {
		background: var(--elevated);
		color: var(--text);
	}
	.mono {
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: 0.85rem;
	}
	.full {
		width: 100%;
	}
	.field-label {
		display: block;
		font-size: 0.8rem;
		color: var(--muted);
		margin-bottom: 0.3rem;
	}
	.checkrow {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.85rem;
		color: var(--muted);
		margin: 0.85rem 0;
	}
	.checkrow input {
		width: auto;
	}
	.token-value {
		word-break: break-all;
		background: var(--elevated);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		padding: 0.75rem;
		margin-bottom: 0.85rem;
	}
</style>
