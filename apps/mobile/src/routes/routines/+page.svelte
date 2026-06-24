<script lang="ts">
	import { onMount } from 'svelte';
	import {
		listRoutines,
		setRoutineFolder,
		duplicateRoutine,
		type RoutineRow
	} from '$lib/repo/routines';
	import {
		listFolders,
		createFolder,
		renameFolder,
		deleteFolder,
		type FolderRow
	} from '$lib/repo/folders';
	import { syncNow } from '$lib/sync';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';

	let folders = $state<FolderRow[]>([]);
	let routines = $state<RoutineRow[]>([]);
	let loading = $state(true);
	let collapsed = $state<Record<string, boolean>>({});

	let folderSheet = $state<{ open: boolean; id?: string; name: string }>({ open: false, name: '' });
	let moveSheet = $state<{ open: boolean; routineId?: string; title?: string }>({ open: false });

	const groups = $derived.by(() => {
		const m = new Map<string, RoutineRow[]>();
		for (const f of folders) m.set(f.id, []);
		const ung: RoutineRow[] = [];
		for (const r of routines) {
			if (r.folder_id && m.has(r.folder_id)) m.get(r.folder_id)!.push(r);
			else ung.push(r);
		}
		return { m, ung };
	});

	async function load() {
		[folders, routines] = await Promise.all([listFolders(), listRoutines()]);
	}

	onMount(async () => {
		await load();
		loading = false;
		try {
			await syncNow();
			await load();
		} catch {
			/* offline — keep local */
		}
	});

	function toggle(id: string) {
		collapsed[id] = !collapsed[id];
	}

	function openNewFolder() {
		folderSheet = { open: true, name: '' };
	}
	function openRenameFolder(f: FolderRow) {
		folderSheet = { open: true, id: f.id, name: f.name };
	}
	function closeFolderSheet() {
		folderSheet = { open: false, name: '' };
	}
	async function saveFolder() {
		const name = folderSheet.name.trim();
		if (!name) return;
		if (folderSheet.id) await renameFolder(folderSheet.id, name);
		else await createFolder(name);
		closeFolderSheet();
		await load();
	}
	async function removeFolder(f: FolderRow) {
		if (!confirm(`Delete folder "${f.name}"? Its routines are kept (moved to ungrouped).`)) return;
		await deleteFolder(f.id);
		await load();
	}

	function openMove(r: RoutineRow) {
		moveSheet = { open: true, routineId: r.id, title: r.title };
	}
	function closeMoveSheet() {
		moveSheet = { open: false };
	}
	async function chooseFolder(folderId: string | null) {
		if (moveSheet.routineId) await setRoutineFolder(moveSheet.routineId, folderId);
		closeMoveSheet();
		await load();
	}
	async function duplicate() {
		if (moveSheet.routineId) await duplicateRoutine(moveSheet.routineId);
		closeMoveSheet();
		await load();
	}
</script>

<svelte:head><title>Routines · Granite</title></svelte:head>

{#snippet routineRow(r: RoutineRow)}
	<div class="rrow" data-testid="routine-row">
		<a class="rrow-title" href="/routines/{r.id}">{r.title}</a>
		<button class="ic" onclick={() => openMove(r)} aria-label="Routine actions" data-testid="btn-routine-menu">
			<Icon name="dots-vertical" size={16} />
		</button>
		<Button href={`/log?routine=${r.id}`} variant="secondary" size="sm" testid="btn-start-routine">
			Start
		</Button>
	</div>
{/snippet}

<main class="container">
	<PageHeader title="Routines">
		{#snippet action()}
			<div class="hdr">
				<Button variant="secondary" size="sm" icon="folder" onclick={openNewFolder} testid="btn-new-folder">
					Folder
				</Button>
				<Button size="sm" icon="plus" href="/routines/new" testid="btn-new-routine">Routine</Button>
			</div>
		{/snippet}
	</PageHeader>

	{#if loading}
		<p class="muted">Loading…</p>
	{:else if routines.length === 0 && folders.length === 0}
		<EmptyState
			icon="routines"
			title="No routines yet"
			description="Build a routine to start workouts faster."
		>
			{#snippet action()}
				<Button href="/routines/new" icon="plus" testid="btn-new-routine-empty">New routine</Button>
			{/snippet}
		</EmptyState>
	{:else}
		{#each folders as f (f.id)}
			<section class="folder" data-testid="folder">
				<div class="folder-head">
					<button class="folder-toggle" onclick={() => toggle(f.id)} data-testid="folder-toggle">
						<Icon name={collapsed[f.id] ? 'chevron-right' : 'chevron-down'} size={16} />
						<Icon name="folder" size={16} />
						<span class="folder-name">{f.name}</span>
						<span class="count">{groups.m.get(f.id)?.length ?? 0}</span>
					</button>
					<div class="folder-actions">
						<button class="ic" onclick={() => openRenameFolder(f)} aria-label="Rename folder">
							<Icon name="edit" size={16} />
						</button>
						<button class="ic" onclick={() => removeFolder(f)} aria-label="Delete folder">
							<Icon name="trash" size={16} />
						</button>
					</div>
				</div>
				{#if !collapsed[f.id]}
					<div class="list">
						{#each groups.m.get(f.id) ?? [] as r (r.id)}
							{@render routineRow(r)}
						{/each}
						{#if (groups.m.get(f.id)?.length ?? 0) === 0}
							<p class="muted empty-folder">Empty — move a routine here.</p>
						{/if}
					</div>
				{/if}
			</section>
		{/each}

		{#if groups.ung.length > 0}
			{#if folders.length > 0}<div class="ungrouped-label">Ungrouped</div>{/if}
			<div class="list">
				{#each groups.ung as r (r.id)}
					{@render routineRow(r)}
				{/each}
			</div>
		{/if}
	{/if}
</main>

<Sheet
	open={folderSheet.open}
	title={folderSheet.id ? 'Rename folder' : 'New folder'}
	onclose={closeFolderSheet}
>
	<input
		class="folder-input"
		placeholder="Folder name"
		bind:value={folderSheet.name}
		data-testid="field-folder-name"
	/>
	<Button block onclick={saveFolder} disabled={!folderSheet.name.trim()} testid="btn-save-folder">
		{folderSheet.id ? 'Save' : 'Create'}
	</Button>
</Sheet>

<Sheet open={moveSheet.open} title={moveSheet.title ?? 'Routine'} onclose={closeMoveSheet}>
	<ul class="movelist">
		<li>
			<button class="move-item" onclick={duplicate} data-testid="btn-duplicate-routine">
				<Icon name="plus" size={16} /> Duplicate
			</button>
		</li>
	</ul>
	<div class="menu-label">Move to folder</div>
	<ul class="movelist">
		<li>
			<button class="move-item" onclick={() => chooseFolder(null)} data-testid="move-target">
				<Icon name="x" size={16} /> No folder
			</button>
		</li>
		{#each folders as f (f.id)}
			<li>
				<button class="move-item" onclick={() => chooseFolder(f.id)} data-testid="move-target">
					<Icon name="folder" size={16} /> {f.name}
				</button>
			</li>
		{/each}
	</ul>
</Sheet>

<style>
	.hdr {
		display: flex;
		gap: 0.4rem;
	}
	.folder {
		margin-bottom: 1.25rem;
	}
	.folder-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		margin-bottom: 0.5rem;
	}
	.folder-toggle {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		flex: 1;
		min-width: 0;
		background: none;
		border: none;
		color: var(--text);
		cursor: pointer;
		font: inherit;
		font-weight: 600;
		padding: 0.2rem 0;
		text-align: left;
	}
	.folder-toggle :global(svg) {
		color: var(--muted);
		flex-shrink: 0;
	}
	.folder-name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.count {
		color: var(--faint);
		font-weight: 500;
		font-size: 0.85rem;
	}
	.folder-actions {
		display: flex;
		gap: 0.1rem;
		flex-shrink: 0;
	}
	.ic {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		background: none;
		border: none;
		color: var(--muted);
		cursor: pointer;
		padding: 6px;
		border-radius: var(--radius-md);
	}
	.ic:hover {
		background: var(--elevated);
		color: var(--text);
	}
	.list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.empty-folder {
		font-size: 0.85rem;
		margin: 0.1rem 0 0;
	}
	.ungrouped-label {
		color: var(--muted);
		font-size: 0.85rem;
		margin: 0 0 0.5rem;
	}
	.rrow {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		padding: 0.85rem 1rem;
	}
	.rrow-title {
		flex: 1;
		min-width: 0;
		font-weight: 600;
		color: var(--text);
		text-decoration: none;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.rrow-title:hover {
		color: var(--accent);
	}
	.folder-input {
		width: 100%;
		margin-bottom: 0.85rem;
	}
	.menu-label {
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--faint);
		margin: 0 0 0.4rem;
	}
	.movelist {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.move-item {
		width: 100%;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.7rem 0.5rem;
		background: none;
		border: none;
		border-bottom: 1px solid var(--border);
		color: var(--text);
		cursor: pointer;
		text-align: left;
		font: inherit;
	}
	.move-item :global(svg) {
		color: var(--muted);
	}
	.move-item:hover {
		color: var(--accent);
	}
</style>
