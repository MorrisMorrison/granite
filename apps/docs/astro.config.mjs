// @ts-check
import { defineConfig, passthroughImageService } from 'astro/config';
import starlight from '@astrojs/starlight';
import mermaid from 'astro-mermaid';

// GitHub Pages project site: served at https://<user>.github.io/granite/
const site = process.env.DOCS_SITE ?? 'https://morrismorrison.github.io';
const base = process.env.DOCS_BASE ?? '/granite';

export default defineConfig({
	site,
	base,
	// The site only uses an SVG hero — skip raster optimization (and the sharp dep).
	image: { service: passthroughImageService() },
	integrations: [
		// Must precede Starlight: renders ```mermaid code blocks client-side and tells
		// Expressive Code to leave them alone. autoTheme follows the site's light/dark mode.
		mermaid({ autoTheme: true }),
		starlight({
			title: 'Granite',
			description:
				'Open-source, self-hostable, offline-first workout tracker. Own your training data.',
			social: [
				{ icon: 'github', label: 'GitHub', href: 'https://github.com/MorrisMorrison/granite' }
			],
			sidebar: [
				{ label: 'Guides', items: [{ autogenerate: { directory: 'guides' } }] },
				{
					label: 'Decisions (ADRs)',
					collapsed: true,
					items: [{ autogenerate: { directory: 'decisions' } }]
				}
			],
			editLink: {
				baseUrl: 'https://github.com/MorrisMorrison/granite/edit/main/docs/'
			},
			// Keep the right-hand "On this page" compact — top-level sections only.
			tableOfContents: { minHeadingLevel: 2, maxHeadingLevel: 2 }
		})
	]
});
