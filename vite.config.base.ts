import { readFileSync, rmSync } from 'node:fs';
import { builtinModules } from 'node:module';
import { resolve } from 'node:path';
import type { UserConfig } from 'vite';

/**
 * Shared Vite configuration for the publishable libraries in `packages/`.
 *
 * Each library bundles `src/index.ts` into a single ESM file at `dist/main.js`, with everything
 * it declares as a dependency left external. Declarations are emitted separately by `tsc`; see
 * each package's `build` script.
 */
export function libConfig(packageDir: string): UserConfig {
    const pkg = JSON.parse(readFileSync(resolve(packageDir, 'package.json'), 'utf8'));
    const externals = [
        ...Object.keys(pkg.dependencies ?? {}),
        ...Object.keys(pkg.peerDependencies ?? {}),
        ...builtinModules,
    ];

    return {
        root: packageDir,
        build: {
            // `dist` is cleaned by the plugin below instead, so that watch mode doesn't wipe the
            // declarations `tsc` writes to `dist/types` in parallel.
            emptyOutDir: false,
            target: 'es2024',
            sourcemap: true,
            minify: false,
            lib: {
                entry: resolve(packageDir, 'src/index.ts'),
                formats: ['es'],
                fileName: () => 'main.js',
            },
            rollupOptions: {
                external: (id) => externals.some((dep) => id === dep || id.startsWith(`${dep}/`)),
            },
        },
        plugins: [
            {
                name: 'vis-clean-dist',
                apply: 'build',
                buildStart() {
                    if (!this.meta.watchMode) {
                        rmSync(resolve(packageDir, 'dist'), { recursive: true, force: true });
                    }
                },
            },
        ],
    };
}
