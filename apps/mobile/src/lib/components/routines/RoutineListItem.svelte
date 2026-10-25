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
		lastDone?: string | null; // relative day ("Yesterday"), null = never
		onmenu: () => void;
	} = $props();

	const subtitle = $derived.by(() => {
		if (exerciseCount === null) return '';
		const n = `${exerciseCount} exercise${exerciseCount === 1 ? '' : 's'}`;
		return `${n} · ${lastDone ? `last done ${lastDone.toLowerCase()}` : 'not done yet'}`;
	});
</script>

<div class="row" data-testid="routine-row">
	<a class="body" href={`/routines/${id}`}>
		<span class="title">{title}</span>
		<span class="sub">{subtitle}</span>
	</a>
	<a class="play" href={`/log?routine=${id}`} aria-label={`Start ${title}`} data-testid="btn-start-routine">
		<Icon name="play" size={16} />
	</a>
	<button class="dots" aria-label="Routine actions" onclick={onmenu} data-testid="btn-routine-menu">
		<Icon name="dots-vertical" size={18} />
	</button>
</div>

<style>
	.row {
		display: flex;
		align-items: center;
		gap: 0.2rem;
		padding: 0.7rem 0.5rem 0.7rem 1.1rem;
	}
	.body {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		color: var(--text);
		text-decoration: none;
	}
	.title {
		font-weight: 650;
		letter-spacing: -0.01em;
		font-size: 1rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.sub {
		font-size: 0.8rem;
		color: var(--muted);
		font-variant-numeric: tabular-nums;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
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
