import { defineConfig } from 'tsup';

export default defineConfig({
	entry: ['src/index.ts'],
	format: ['esm'],
	target: 'node20',
	clean: true,
	// Inline the workspace package; runtime deps (sdk, zod, openapi-fetch) stay external.
	noExternal: ['@granite/shared'],
	banner: { js: '#!/usr/bin/env node' }
});
