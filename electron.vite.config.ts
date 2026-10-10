import { resolve } from 'node:path';
import { defineConfig } from 'electron-vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  main: {},
  preload: {
    build: { rollupOptions: { input: { shell: resolve('src/preload/shell.ts'), service: resolve('src/preload/service.ts') } } },
  },
  renderer: {
    plugins: [react()],
  },
});
