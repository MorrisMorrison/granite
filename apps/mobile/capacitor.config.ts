import type { CapacitorConfig } from '@capacitor/cli';

// The native shell around the same static build the Go binary embeds.
const config: CapacitorConfig = {
	appId: 'io.github.morrismorrison.granite',
	appName: 'Granite',
	webDir: 'build',
	android: {
		// The app runs on https://localhost; self-hosted servers on plain http (LAN)
		// would otherwise be blocked as mixed content.
		allowMixedContent: true,
		// The connect check uses AbortSignal.timeout (Chromium 103+).
		minWebViewVersion: 103
	},
	// cleartext only matters for live-reload (server.url); plain-http servers work via allowMixedContent + the manifest's usesCleartextTraffic
	server: { androidScheme: 'https', cleartext: true },
	plugins: {
		LocalNotifications: { smallIcon: 'ic_stat_granite', iconColor: '#2563eb' }
	}
};

export default config;
