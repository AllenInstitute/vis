import { defineConfig } from 'vite';
import { libConfig } from '../../vite.config.base.ts';

export default defineConfig(libConfig(import.meta.dirname));
