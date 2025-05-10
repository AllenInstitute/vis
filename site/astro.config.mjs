// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import starlight from '@astrojs/starlight';

import react from '@astrojs/react';

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
                        { label: 'DZI', slug: 'examples/dzi' },
                        { label: 'OME-Zarr', slug: 'examples/ome-zarr' },
                        { label: 'Layers Demo', slug: 'examples/layers' },
                    ],
                },
                {
                    label: 'Reference',
                    autogenerate: { directory: 'reference' },
                },
                {
                    label: 'For Vis Developers',
                    autogenerate: { directory: 'developers' },
                },
            ],
        }),
        mdx(),
        react(),
    ],
});
