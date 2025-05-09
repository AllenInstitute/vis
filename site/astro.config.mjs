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
					label: 'Examples',
					items: [
						// Each item here is one entry in the navigation menu.
						{ label: 'DZI', slug: 'examples/diz' },
						{ label: 'OME-Zarr', slug: 'examples/ome-zarr' },
						{ label: 'Layers Demo', slug: 'guides/layers' },
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
