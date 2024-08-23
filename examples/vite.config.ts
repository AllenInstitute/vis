import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';
// https://vitejs.dev/config/
export default defineConfig({
    build:{
        rollupOptions: {
            input: {
                layers: path.resolve(__dirname, './layers.html'),
                topo:  path.resolve(__dirname, './topo.html'),
            }
        }
    },
    plugins: [react()],
    resolve: {
        alias: {
            '~': path.resolve(__dirname, './src'),
        },
    },
});
