// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// GitHub Pages project site: served at https://<user>.github.io/granite/
const site = process.env.DOCS_SITE ?? 'https://morrismorrison.github.io';
const base = process.env.DOCS_BASE ?? '/granite';

export default defineConfig({
	site,
	base,
	integrations: [
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
			}
		})
	]
});
