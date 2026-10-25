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
	<p class="muted server" data-testid="server-line">
		Server: {host} · <a href="/connect?change=1" data-testid="btn-change-server">Change</a>
	</p>
{/if}

<style>
	.server {
		text-align: center;
		font-size: 0.85rem;
		margin-top: 0.5rem;
	}
</style>
