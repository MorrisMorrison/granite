import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vitest/config';
import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { codecovVitePlugin } from '@codecov/vite-plugin';

// Build identity shown in Settings: "<semver>+<short-sha> · <date>". The SHA comes
// from CI/Docker via PUBLIC_GIT_SHA (the image is built without .git); falls back
// to a local git call, then "dev".
const pkgVersion = JSON.parse(readFileSync('./package.json', 'utf-8')).version;
const gitSha = (
	process.env.PUBLIC_GIT_SHA ??
	(() => {
		try {
			return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
				.toString()
				.trim();
		} catch {
			return 'dev';
		}
	})()
).slice(0, 7);
const appVersion = `${pkgVersion}+${gitSha} · ${new Date().toISOString().slice(0, 10)}`;

export default defineConfig({
	plugins: [
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) => filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: adapter({ fallback: 'index.html' }),
			version: { name: appVersion }
		}),
		// Codecov bundle analysis — uploads bundle stats on build when a token is
		// present (CI). No-op locally, so dev/build without the token is unaffected.
		codecovVitePlugin({
			enableBundleAnalysis: process.env.CODECOV_TOKEN !== undefined,
			bundleName: 'granite-mobile',
			uploadToken: process.env.CODECOV_TOKEN
		})
	],
	test: {
		expect: { requireAssertions: true },
		coverage: {
			provider: 'v8',
			reporter: ['text-summary', 'text', 'html', 'lcov'],
			// The logic worth measuring lives in src/lib; routes are screens (e2e's job).
			include: ['src/lib/**/*.{ts,svelte}'],
			// Excluded: barrel + trivial env/runtime-config plumbing.
			exclude: [
				'**/*.{test,spec}.{js,ts}',
				'**/*.d.ts',
				'src/lib/index.ts',
				'src/lib/config.ts'
			]
		},
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			},
			{
				extends: './vite.config.ts',
				// Resolve Svelte to its client build so components can mount in jsdom.
				resolve: { conditions: ['browser'] },
				test: {
					name: 'client',
					environment: 'jsdom',
					include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
					setupFiles: ['./vitest-setup-client.ts']
				}
			}
		]
	}
});
