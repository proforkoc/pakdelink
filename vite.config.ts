import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, Plugin } from 'vite';
import fs from 'fs';

const nojekyllPlugin = (): Plugin => ({
  name: 'nojekyll-plugin',
  closeBundle() {
    try {
      const distDir = path.resolve(import.meta.dirname, 'dist');
      if (fs.existsSync(distDir)) {
        fs.writeFileSync(path.join(distDir, '.nojekyll'), '');
      }
    } catch {
      // ignore
    }
  },
});

export default defineConfig(() => {
  return {
    base: './',
    plugins: [react(), tailwindcss(), nojekyllPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      // HMR is disabled in AI Studio environment
      hmr: false,
      watch: null,
    },
  };
});
