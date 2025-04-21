import path from 'node:path';
import react from '@vitejs/plugin-react-swc';
import { defineConfig } from 'vite';
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
    worker: {
        format: 'es'
    }
});
