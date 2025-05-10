// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import starlight from '@astrojs/starlight';

import react from '@astrojs/react';

// https://astro.build/config
export default defineConfig({
    integrations: [
        starlight({
            title: 'Vis',
            social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/AllenInstitute/vis' }],
            sidebar: [
                {
                    label: 'Examples',
                    autogenerate: { directory: 'examples' },
                },
                {
                    label: 'Reference',
                    autogenerate: { directory: 'reference' },
                },
                {
                    label: 'Developers',
                    autogenerate: { directory: 'developers' },
                },
            ],
        }),
        mdx(),
        react(),
    ],
    vite: {
        // Needed for the Rollup build changes to work
        worker: {
            format: 'es', // Explicitly set worker format to ES modules
        },
    },
});
