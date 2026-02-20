// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import starlight from '@astrojs/starlight';

import react from '@astrojs/react';

// https://astro.build/config
export default defineConfig({
    // `site` and `base` enables GitHub Pages deployment to function
    site: 'https://alleninstitute.github.io',
    base: 'vis',
    integrations: [
        starlight({
            title: 'Vis',
            customCss: ['./custom.css'],
            social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/AllenInstitute/vis' }],
            sidebar: [
                {
                    label: 'Getting Started',
                    autogenerate: { directory: 'getting-started' },
                },
                {
                    label: 'Examples',
                    autogenerate: { directory: 'examples' },
                },
                {
                    label: 'Packages',
                    autogenerate: { directory: 'packages' },
                },
                {
                    label: 'Vis Package Developers',
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
