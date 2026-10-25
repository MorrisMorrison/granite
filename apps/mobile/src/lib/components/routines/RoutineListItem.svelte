<script lang="ts">
	import Icon from '#lib/components/ui/Icon.svelte';

	// One routine in a folder card: title + "{n} exercises · last done …" linking to the
	// detail page, a quiet start button and the actions menu.
	let {
		id,
		title,
		exerciseCount = null,
		lastDone = null,
		onmenu
	}: {
		id: string;
		title: string;
		exerciseCount?: number | null; // null while still loading
		lastDone?: string | null; // relative day ("yesterday", "12 Oct"), null = never
		onmenu: () => void;
	} = $props();

	const subtitle = $derived.by(() => {
		if (exerciseCount === null) return '';
		const n = `${exerciseCount} exercise${exerciseCount === 1 ? '' : 's'}`;
		return `${n} · ${lastDone ? `last done ${lastDone}` : 'not done yet'}`;
	});
</script>

<div class="group-row row">
	<a class="group-row-body" href={`/routines/${id}`} data-testid="routine-row">
		<span class="group-row-title">{title}</span>
		<span class="group-row-sub">{subtitle}</span>
	</a>
	<a class="play" href={`/log?routine=${id}`} aria-label={`Start ${title}`} data-testid="btn-start-routine">
		<Icon name="play" size={16} />
	</a>
	<button class="dots" aria-label="Routine actions" onclick={onmenu} data-testid="btn-routine-menu">
		<Icon name="dots-vertical" size={18} />
	</button>
</div>

<style>
	/* Tighter gap/right padding than a link row: two icon buttons sit at the end. */
	.row {
		gap: 0.2rem;
		padding-right: 0.5rem;
	}
	.play {
		display: inline-flex;
		padding: 6px;
		color: var(--accent);
		border-radius: var(--radius-md);
		text-decoration: none;
	}
	.play:hover {
		background: var(--accent-subtle);
	}
	.dots {
		display: inline-flex;
		padding: 6px;
		background: none;
		border: none;
		color: var(--faint);
		border-radius: var(--radius-md);
		cursor: pointer;
	}
	.dots:hover {
		color: var(--text);
		background: var(--elevated);
	}
</style>
