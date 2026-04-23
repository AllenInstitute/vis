import { defineConfig } from 'vite'
import { resolve } from 'node:path';
import dts from 'vite-plugin-dts';
import typegpuPlugin from 'unplugin-typegpu/vite';

export default defineConfig({
    build: {
        lib: {
            entry: resolve(import.meta.dirname, 'src/index.ts'),
            formats: ['es'],
            fileName: 'module',
        },
    },
    resolve: {
        alias: {
            '@': resolve(import.meta.dirname, 'src'),
        },
    },
    plugins: [
        typegpuPlugin(),
        dts({
            rollupTypes: true,
        }),
    ],
});