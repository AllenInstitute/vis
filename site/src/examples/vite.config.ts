import path from 'node:path';
import fs from 'node:fs';
import react from '@vitejs/plugin-react-swc';
import { defineConfig } from 'vite';

// TODO: Delete, but need to do basename

// To support the layers demo we need to include the layers.html file in the build,
// which we do by configuring Rollup to use any HTML files in the /examples directory
function getHtmlEntries() {
    const pagesDir = path.resolve(__dirname, '');
    const entries = {};

    // Read all files in the directory
    const files = fs.readdirSync(pagesDir);

    // Filter out HTML files
    const htmlFiles = files.filter((file) => file.endsWith('.html'));

    // Create entries for each HTML file
    for (const file of htmlFiles) {
        const name = path.basename(file, '.html');
        //@ts-ignore This is fine
        entries[name] = path.resolve(pagesDir, file);
    }

    return entries;
}

// https://vitejs.dev/config/
export default defineConfig({
    // `base` enables GitHub Pages deployment to function
    base: '/vis/',
    plugins: [react()],
    resolve: {
        alias: {
            '~': path.resolve(__dirname, './src'),
        },
    },
    // Used to get the layers.html file in the build, remove once it's migrated to a React component
    build: {
        rollupOptions: {
            input: getHtmlEntries(),
            output: {
                format: 'es',
            },
        },
    },
    // Needed for the Rollup build changes to work
    worker: {
        format: 'es', // Explicitly set worker format to ES modules
    },
});
