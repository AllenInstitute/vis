import { defineConfig } from 'vite';
import { resolve } from 'path';
// https://vitejs.dev/config/
export default defineConfig({
    build: {
        lib: {
            entry: resolve(__dirname, 'src/index.ts'),
            name: 'omezarr',
            fileName: 'omezarr',
        },
        rollupOptions: {
        },
    },
    resolve: {
        alias: {
            '~': resolve(__dirname, './src'),
        },
    },
});
