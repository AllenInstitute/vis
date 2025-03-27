import path from 'node:path';
import react from '@vitejs/plugin-react-swc';
import { defineConfig } from 'vite';
// https://vitejs.dev/config/
export default defineConfig({
    // `base` enables GitHub Pages deployment to function
    base: '/vis/',
    build: {
        rollupOptions: {
            input: {
                layers: path.resolve(__dirname, './layers.html'),
                dzi: path.resolve(__dirname, './dzi.html'),
            },
        },
    },
    plugins: [react()],
    resolve: {
        alias: {
            '~': path.resolve(__dirname, './src'),
        },
    },
});
