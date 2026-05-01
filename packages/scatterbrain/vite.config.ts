import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import dts from 'vite-plugin-dts';

export default defineConfig({
    build: {
        lib: {
            entry: resolve(import.meta.dirname, 'src/index.ts'),
            formats: ['es'],
            fileName: 'main',
        },
    },
    resolve: {
        alias: {
            '~': resolve(import.meta.dirname, './'),
        },
    },
    plugins: [
        dts({
            tsconfigPath: './tsconfig.json',
            rollupTypes: true,
        }),
    ],
});
