<script lang="ts">
	import { onMount } from 'svelte';
	import {
		listRoutines,
		getRoutine,
		setRoutineFolder,
		duplicateRoutine,
		deleteRoutine,
		type RoutineRow
	} from '#lib/repo/routines.ts';
	import {
		listFolders,
		createFolder,
		renameFolder,
		deleteFolder,
		type FolderRow
	} from '#lib/repo/folders.ts';
	import { syncNow } from '#lib/sync/index.ts';
	import PageHeader from '#lib/components/ui/PageHeader.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import EmptyState from '#lib/components/ui/EmptyState.svelte';
	import Sheet from '#lib/components/ui/Sheet.svelte';
	import Icon from '#lib/components/ui/Icon.svelte';
	import { listWorkouts } from '#lib/repo/workouts.ts';
	import { lastDoneAt, relativeDayInline } from '#lib/stats.ts';
	import FolderGroup from '#lib/components/routines/FolderGroup.svelte';
	import RoutineListItem from '#lib/components/routines/RoutineListItem.svelte';

	// Per-routine exercise count + last-done label. Filled in after the list has rendered
	// (it needs one getRoutine per routine), so the list never waits on it.
	let info = $state<Record<string, { count: number; last: string | null }>>({});
	async function loadInfo(rows: RoutineRow[]) {
		const ws = await listWorkouts();
		const full = await Promise.all(rows.map((r) => getRoutine(r.id)));
		const now = Date.now();
		const out: Record<string, { count: number; last: string | null }> = {};
		rows.forEach((r, i) => {
			const at = lastDoneAt(r, ws);
			out[r.id] = {
				count: full[i]?.exercises.length ?? 0,
				last: at == null ? null : relativeDayInline(at, now)
			};
		});
		info = out;
	}

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
		void loadInfo(routines).catch(() => {}); // the counts are decoration; never block the list
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
	async function removeRoutine() {
		if (!moveSheet.routineId) return;
		if (!confirm(`Delete routine "${moveSheet.title ?? ''}"? This cannot be undone.`)) return;
		await deleteRoutine(moveSheet.routineId);
		closeMoveSheet();
		await load();
	}
</script>

<svelte:head><title>Routines · Granite</title></svelte:head>

{#snippet routineRow(r: RoutineRow)}
	<RoutineListItem
		id={r.id}
		title={r.title}
		exerciseCount={info[r.id]?.count ?? null}
		lastDone={info[r.id]?.last ?? null}
		onmenu={() => openMove(r)}
	/>
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
			{@const rs = groups.m.get(f.id) ?? []}
			<FolderGroup
				name={f.name}
				count={rs.length}
				collapsed={!!collapsed[f.id]}
				empty={rs.length === 0}
				testid="folder"
				ontoggle={() => toggle(f.id)}
				onrename={() => openRenameFolder(f)}
				ondelete={() => removeFolder(f)}
			>
				{#each rs as r (r.id)}{@render routineRow(r)}{/each}
			</FolderGroup>
		{/each}

		{#if groups.ung.length > 0}
			<FolderGroup name={folders.length > 0 ? 'Ungrouped' : ''}>
				{#each groups.ung as r (r.id)}{@render routineRow(r)}{/each}
			</FolderGroup>
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
		<li>
			<button class="move-item danger" onclick={removeRoutine} data-testid="btn-delete-routine">
				<Icon name="trash" size={16} /> Delete
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
	.move-item.danger {
		color: var(--danger);
	}
	.move-item.danger :global(svg) {
		color: var(--danger);
	}
	.move-item.danger:hover {
		color: var(--danger);
	}
</style>
