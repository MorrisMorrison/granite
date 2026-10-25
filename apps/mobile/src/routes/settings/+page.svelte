<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { isNative } from '#lib/platform/native.ts';
	import { version } from '$app/env';
	import { auth } from '#lib/stores/auth.svelte.ts';
	import { prefs } from '#lib/stores/prefs.svelte.ts';
	import { api } from '#lib/api/client.ts';
	import { resync, syncNow, resetLocalData } from '#lib/sync/index.ts';
	import { buildHevyImport } from '#lib/hevy.ts';
	import { getServerUrl } from '#lib/config.ts';
	import type { paths } from '@granite/shared';
	import PageHeader from '#lib/components/ui/PageHeader.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import Sheet from '#lib/components/ui/Sheet.svelte';
	import IconButton from '#lib/components/ui/IconButton.svelte';
	import Icon from '#lib/components/ui/Icon.svelte';
	import FormError from '#lib/components/ui/FormError.svelte';

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

	let importing = $state(false);
	let importError = $state('');
	let importMessage = $state('');
	let serverError = $state('');

	// Switching servers signs out and clears local data (logout already wipes it).
	// logout() refuses while changes are unsynced — then stay put, or the switch
	// would wipe exactly the offline work logout protected.
	async function changeServer() {
		if (!confirm('Change server? You will be signed out and this device’s local data cleared.')) return;
		serverError = '';
		await auth.logout();
		if (auth.isAuthenticated) {
			serverError = 'Sync your changes first: some workouts haven’t reached the server yet.';
			return;
		}
		// clearSession() just nulled the user, so the layout's auth effect also navigates to /login; this later goto supersedes it (SvelteKit cancels the earlier navigation).
		await goto('/connect?change=1');
	}
	let fileInput: HTMLInputElement;

	let hevyImporting = $state(false);
	let hevyInput: HTMLInputElement;

	let resetting = $state(false);
	let resetError = $state('');

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

	type ImportBody = NonNullable<
		paths['/api/v1/import']['post']['requestBody']
	>['content']['application/json'];

	async function onImportFile(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = ''; // let the same file be picked again later
		if (!file) return;
		importing = true;
		importError = '';
		importMessage = '';
		try {
			const dump = JSON.parse(await file.text()) as ImportBody;
			const { data, error } = await api().POST('/api/v1/import', { body: dump });
			if (error || !data) {
				importError = 'Import failed — is this a Granite export?';
				return;
			}
			const c = data.imported;
			const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;
			importMessage = `Imported ${plural(c.routines, 'routine')}, ${plural(c.workouts, 'workout')}, ${plural(c.folders, 'folder')}.`;
			// Full re-pull: imported records keep their original (older) timestamps,
			// so a plain incremental sync would skip them on an already-synced device.
			try {
				await resync();
			} catch {
				/* offline — they'll sync on reconnect */
			}
		} catch {
			importError = 'Could not read that file — expected a Granite JSON export.';
		} finally {
			importing = false;
		}
	}

	async function onHevyFile(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (!file) return;
		hevyImporting = true;
		importError = '';
		importMessage = '';
		try {
			const text = await file.text();
			// Map against the *server's* live library, not the local cache: the import
			// is online anyway, and the workouts reference exercise ids that must exist
			// on the server. A stale local cache (e.g. after a server reseed) would map
			// to ids the server no longer has → FK errors.
			const { data: lib, error: libErr } = await api().GET('/api/v1/exercises');
			if (libErr || !lib) {
				importError = 'Could not load your exercise library — are you online?';
				return;
			}
			const { envelope, workoutCount, customExercises } = buildHevyImport(
				text,
				(lib.exercises ?? []).map((e) => ({ id: e.id, name: e.name }))
			);
			if (workoutCount === 0) {
				importError = 'No workouts found — is this a Hevy CSV export?';
				return;
			}
			const { data, error } = await api().POST('/api/v1/import', { body: envelope as ImportBody });
			if (error || !data) {
				importError = 'Import failed — are you online?';
				return;
			}
			const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;
			const extra = customExercises.length
				? ` (${plural(customExercises.length, 'new exercise')} added)`
				: '';
			importMessage = `Imported ${plural(workoutCount, 'workout')}${extra}.`;
			try {
				await resync();
			} catch {
				/* offline — they'll sync on reconnect */
			}
		} catch {
			importError = 'Could not read that file — expected a Hevy CSV export.';
		} finally {
			hevyImporting = false;
		}
	}

	// Wipe this device's local copy and re-pull from the server. Fixes a stale cache
	// (e.g. duplicates after the server DB was reset) without needing browser tools.
	async function onResetLocal() {
		if (
			!confirm(
				'Clear this device’s local copy and re-download everything from the server? Any changes not yet synced will be lost.'
			)
		)
			return;
		resetting = true;
		resetError = '';
		try {
			await resetLocalData();
			await syncNow();
			location.reload();
		} catch {
			resetError = 'Reset failed — check your connection and try again.';
			resetting = false;
		}
	}

	function fmtDate(ms: number): string {
		return new Date(ms).toLocaleDateString(undefined, {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	}

	// "read+write · gra_ab12… · created 3 Oct 2026 · last used 5 Oct 2026"
	function tokenMeta(t: TokenRow): string {
		const used = t.last_used_at ? `last used ${fmtDate(t.last_used_at)}` : 'never used';
		return `${isWrite(t) ? 'read+write' : 'read'} · ${t.prefix}… · created ${fmtDate(t.created_at)} · ${used}`;
	}
</script>

<svelte:head><title>Settings · Granite</title></svelte:head>

<main class="container">
	<PageHeader title="Settings" />

	<section class="block" aria-labelledby="s-account">
		<h2 class="eyebrow label" id="s-account">Account</h2>
		<div class="group">
			<div class="group-row srow">
				<span class="srow-label">Email</span>
				<span class="srow-val" data-testid="settings-email">{auth.user?.email ?? '—'}</span>
			</div>
			<div class="group-row srow">
				<span class="srow-label">Server</span>
				<span class="srow-val mono" title={getServerUrl()}>{getServerUrl()}</span>
				{#if isNative()}
					<Button variant="outline" size="sm" onclick={changeServer} testid="btn-settings-change-server">
						Change server
					</Button>
				{/if}
			</div>
			<div class="group-row srow">
				<span class="srow-label">Version</span>
				<span class="srow-val mono faint" data-testid="app-version">{version}</span>
			</div>
		</div>
		{#if serverError}
			<div class="msg"><FormError message={serverError} testid="change-server-error" /></div>
		{/if}
	</section>

	<section class="block" aria-labelledby="s-prefs">
		<h2 class="eyebrow label" id="s-prefs">Preferences</h2>
		<div class="group">
			<div class="group-row srow">
				<label class="srow-label" for="pref-unit">Weight unit</label>
				<select
					id="pref-unit"
					class="control compact"
					value={prefs.current.weightUnit}
					onchange={(e) => prefs.update({ weightUnit: e.currentTarget.value as 'kg' | 'lb' })}
					data-testid="field-weight-unit"
				>
					<option value="kg">kg</option>
					<option value="lb">lb</option>
				</select>
			</div>
			<div class="group-row srow">
				<span class="srow-label">
					<label for="pref-rest">Default rest</label>
					<span class="group-row-sub" id="pref-rest-hint">Seconds between sets</span>
				</span>
				<input
					id="pref-rest"
					class="control compact"
					type="number"
					inputmode="numeric"
					min="0"
					aria-describedby="pref-rest-hint"
					value={prefs.current.restSeconds}
					onchange={(e) => prefs.update({ restSeconds: Math.max(0, Number(e.currentTarget.value) || 0) })}
					data-testid="field-rest-seconds"
				/>
			</div>
		</div>
	</section>

	<section class="block" aria-labelledby="s-data">
		<h2 class="eyebrow label" id="s-data">Your data</h2>
		<p class="desc">
			Export everything — routines, workouts, exercises — as a JSON file, or import a previous
			Granite export. Importing merges by id (last write wins). You can also import a workout-history
			CSV from another tracker.
		</p>
		<div class="group">
			<button class="group-row action" onclick={exportData} disabled={exporting} data-testid="btn-export">
				<Icon name="download" size={18} />
				<span class="group-row-body">{exporting ? 'Exporting…' : 'Export JSON'}</span>
				<span class="group-row-chev"><Icon name="chevron-right" size={18} /></span>
			</button>
			<button class="group-row action" onclick={() => fileInput.click()} disabled={importing} data-testid="btn-import">
				<Icon name="upload" size={18} />
				<span class="group-row-body">{importing ? 'Importing…' : 'Import JSON'}</span>
				<span class="group-row-chev"><Icon name="chevron-right" size={18} /></span>
			</button>
			<button
				class="group-row action"
				onclick={() => hevyInput.click()}
				disabled={hevyImporting}
				data-testid="btn-import-hevy"
			>
				<Icon name="upload" size={18} />
				<span class="group-row-body">{hevyImporting ? 'Importing…' : 'Import from Hevy (CSV)'}</span>
				<span class="group-row-chev"><Icon name="chevron-right" size={18} /></span>
			</button>
		</div>
		<input
			bind:this={fileInput}
			type="file"
			accept="application/json,.json"
			onchange={onImportFile}
			class="sr-only"
			tabindex="-1"
			data-testid="field-import"
		/>
		<input
			bind:this={hevyInput}
			type="file"
			accept="text/csv,.csv"
			onchange={onHevyFile}
			class="sr-only"
			tabindex="-1"
			data-testid="field-import-hevy"
		/>
		{#if exportError || importError}
			<div class="msg">
				<FormError message={exportError} />
				<FormError message={importError} />
			</div>
		{/if}
		<!-- Always in the DOM so screen readers announce the text when it changes. -->
		<p class="success" role="status">{importMessage}</p>

		<div class="card reset">
			<p class="desc">
				Reset this device’s local copy and re-download from the server. Use this if you see duplicate
				or stale data after a server change.
			</p>
			<FormError message={resetError} />
			<Button variant="danger" block onclick={onResetLocal} disabled={resetting} testid="btn-reset-local">
				{resetting ? 'Resetting…' : 'Reset local data'}
			</Button>
		</div>
	</section>

	<section class="block" aria-labelledby="s-tokens">
		<div class="block-head">
			<h2 class="eyebrow" id="s-tokens">API tokens</h2>
			<Button
				variant="outline"
				size="sm"
				icon="plus"
				onclick={() => (createSheet = { open: true, name: '', write: false })}
				testid="btn-new-token"
			>
				New
			</Button>
		</div>
		<p class="desc">
			Personal tokens for scripts and integrations. Read-only by default; grant write to log
			workouts or edit routines.
		</p>
		{#if tokensError}<div class="msg top"><FormError message={tokensError} /></div>{/if}

		<div class="group">
			{#if tokensLoading}
				<p class="group-row empty">Loading…</p>
			{:else if tokens.length === 0}
				<p class="group-row empty">No tokens yet.</p>
			{:else}
				{#each tokens as t (t.id)}
					<div class="group-row token" data-testid="token-row">
						<span class="group-row-body">
							<span class="group-row-title">{t.name}</span>
							<span class="group-row-sub">{tokenMeta(t)}</span>
						</span>
						<IconButton name="trash" label={`Revoke ${t.name}`} onclick={() => revoke(t)} testid="btn-revoke-token" />
					</div>
				{/each}
			{/if}
		</div>
	</section>
</main>

<!-- Create token -->
<Sheet
	open={createSheet.open}
	title="New API token"
	onclose={() => (createSheet = { open: false, name: '', write: false })}
>
	<div class="form">
		<label class="field" for="token-name">
			<span class="eyebrow">Name</span>
			<input
				id="token-name"
				class="control"
				placeholder="e.g. My script"
				bind:value={createSheet.name}
				data-testid="field-token-name"
			/>
		</label>
		<div class="check-row">
			<input
				id="token-write"
				type="checkbox"
				bind:checked={createSheet.write}
				aria-describedby="token-write-hint"
				data-testid="field-token-write"
			/>
			<div class="check-row-text">
				<label for="token-write">Allow write access</label>
				<p class="field-hint" id="token-write-hint">Log workouts, edit routines.</p>
			</div>
		</div>
		<Button block onclick={createToken} disabled={creating || !createSheet.name.trim()} testid="btn-create-token">
			{creating ? 'Creating…' : 'Create token'}
		</Button>
	</div>
</Sheet>

<!-- Token created — shown once -->
<Sheet open={newToken !== null} title="Token created" onclose={() => (newToken = null)}>
	<div class="form">
		<p class="desc flush">Copy it now — for security it won't be shown again.</p>
		<div class="token-value mono" data-testid="new-token-value">{newToken}</div>
		<Button block onclick={copyToken} icon={copied ? 'check' : undefined} testid="btn-copy-token">
			{copied ? 'Copied' : 'Copy to clipboard'}
		</Button>
	</div>
</Sheet>

<style>
	.block {
		margin-bottom: 1.6rem;
	}
	.label {
		margin: 0 0 0.45rem;
	}
	.block-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 0.45rem;
	}
	.desc {
		margin: 0 0 0.6rem;
		font-size: 0.85rem;
		line-height: 1.45;
		color: var(--muted);
	}
	.desc.flush {
		margin: 0;
	}
	/* Settings row: label left, value or compact control right. */
	.srow {
		min-height: 3.1rem;
		padding-right: 0.9rem;
	}
	.srow-label {
		flex: 1 1 auto;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
		color: var(--text);
	}
	.srow-label .group-row-sub {
		white-space: normal;
	}
	.srow-val {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		text-align: right;
		color: var(--muted);
	}
	.faint {
		color: var(--faint);
	}
	.mono {
		font-family: var(--font-mono);
		font-size: 0.82rem;
	}
	.action > :global(svg) {
		flex-shrink: 0;
		color: var(--muted);
	}
	.action:disabled > :global(svg) {
		color: var(--faint);
	}
	.msg {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		margin-top: 0.6rem;
	}
	.msg.top {
		margin: 0 0 0.6rem;
	}
	.success {
		margin: 0;
		font-size: 0.875rem;
		color: var(--success);
	}
	.success:not(:empty) {
		margin-top: 0.6rem;
	}
	.reset {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		margin-top: 0.9rem;
	}
	.reset .desc {
		margin: 0;
	}
	.empty {
		margin: 0;
		color: var(--muted);
		font-size: 0.9rem;
	}
	.token {
		padding-right: 0.4rem;
	}
	/* Token meta can be long (scope, prefix, two dates): wrap rather than cut it off. */
	.token .group-row-sub {
		white-space: normal;
	}
	.token :global(.ib) {
		color: var(--faint);
	}
	.token-value {
		word-break: break-all;
		background: var(--elevated);
		border-radius: var(--radius-md);
		padding: 0.75rem 0.85rem;
	}
</style>
