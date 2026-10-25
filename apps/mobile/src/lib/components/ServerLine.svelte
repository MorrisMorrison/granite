<script lang="ts">
	import { getServerUrl } from '#lib/config.ts';
	import { isNative } from '#lib/platform/native.ts';

	// Under the sign-in forms in the native app: which server you're signing in to.
	const host = (() => {
		try {
			return new URL(getServerUrl()).host;
		} catch {
			return getServerUrl();
		}
	})();
</script>

{#if isNative()}
	<p class="server" data-testid="server-line">
		Server: <span class="host">{host}</span> · <a href="/connect?change=1" data-testid="btn-change-server">Change</a>
	</p>
{/if}

<style>
	.server {
		max-width: 100%;
		margin: 0;
		font-size: 0.8rem;
		color: var(--faint);
		overflow-wrap: anywhere;
	}
	.host {
		font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
		color: var(--muted);
	}
	.server a {
		color: var(--muted);
		font-weight: 600;
	}
</style>
