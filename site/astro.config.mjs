// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
	integrations: [
		starlight({
			title: 'Allen Institute Vis Tools',
			social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/AllenInstitute/vis' }],
			sidebar: [
				{
					label: 'Guides',
					items: [
						// Each item here is one entry in the navigation menu.
						{ label: 'Example Guide', slug: 'guides/example' },
					],
				},
				{
					label: 'Reference',
					autogenerate: { directory: 'reference' },
				},
                {
                    label: 'For Vis Developers',
                    autogenerate: { directory: 'developers' },
                }
			],
		}),
	],
});
