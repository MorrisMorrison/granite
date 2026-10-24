<script lang="ts">
	import type { ExerciseInput } from '$lib/repo/exercises';
	import { filterExercises } from '$lib/exerciseSearch';
	import Button from '$lib/components/ui/Button.svelte';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import ExerciseForm from '$lib/components/ExerciseForm.svelte';

	interface PickerExercise {
		id: string;
		name: string;
		primary_muscle: string;
	}

	// Bottom sheet for adding an exercise (routine editor + workout logger): a search
	// field that narrows the library as you type, plus inline "New exercise".
	// `library` null = still loading.
	let {
		open = false,
		library,
		onpick,
		oncreate,
		onclose
	}: {
		open?: boolean;
		library: PickerExercise[] | null;
		onpick: (ex: PickerExercise) => void;
		oncreate: (input: ExerciseInput) => Promise<void>;
		onclose: () => void;
	} = $props();

	let query = $state('');
	let creating = $state(false);
	const filtered = $derived(filterExercises(library ?? [], query));

	// Every open starts fresh: empty search, list view.
	$effect(() => {
		if (open) {
			query = '';
			creating = false;
		}
	});
</script>

<Sheet {open} title={creating ? 'New exercise' : 'Add exercise'} {onclose}>
	{#if creating}
		<button type="button" class="link" onclick={() => (creating = false)}>← Back to list</button>
		<ExerciseForm initialName={query.trim()} submitLabel="Create & add" onsubmit={oncreate} />
	{:else if library === null}
		<p class="muted">Loading…</p>
	{:else}
		<div class="search-row">
			<input
				type="search"
				placeholder="Search exercises…"
				bind:value={query}
				aria-label="Search exercises"
				data-testid="field-picker-search"
				data-autofocus
			/>
			<Button
				variant="outline"
				size="sm"
				icon="plus"
				onclick={() => (creating = true)}
				testid="btn-picker-new-exercise"
			>
				New
			</Button>
		</div>
		<ul class="lib">
			{#each filtered as l (l.id)}
				<li>
					<button class="lib-item" onclick={() => onpick(l)} data-testid="picker-exercise">
						<span>{l.name}</span><span class="muted">{l.primary_muscle}</span>
					</button>
				</li>
			{:else}
				<li class="empty" data-testid="picker-empty">
					<p class="muted">No exercises match “{query.trim()}”.</p>
					<button type="button" class="link" onclick={() => (creating = true)}>
						Create “{query.trim()}”
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</Sheet>

<style>
	.search-row {
		display: flex;
		gap: 0.5rem;
		align-items: center;
		margin-bottom: 0.5rem;
	}
	.search-row input {
		flex: 1;
		min-width: 0;
	}
	/* Fixed-height scroll area: the sheet doesn't jump in size while you type. */
	.lib {
		list-style: none;
		margin: 0;
		padding: 0;
		height: min(22rem, 55vh);
		overflow-y: auto;
	}
	.lib-item {
		width: 100%;
		display: flex;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 0.6rem 0.5rem;
		background: none;
		border: none;
		border-bottom: 1px solid var(--border);
		color: var(--text);
		cursor: pointer;
		text-align: left;
	}
	.empty {
		padding: 1.25rem 0.5rem;
		text-align: center;
	}
	.empty p {
		margin: 0 0 0.5rem;
	}
	.link {
		background: none;
		border: none;
		color: var(--accent);
		cursor: pointer;
		font: inherit;
		padding: 0;
	}
</style>
