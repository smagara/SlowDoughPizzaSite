import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import siteContent from './tools/vite-plugin-site-content.mjs';
import decapAdmin from './tools/vite-plugin-decap-admin.mjs';

export default defineConfig(() => {
  return {
    // GitHub Pages project sites are served from /<repo-name>/. The deploy
    // workflow sets VITE_BASE_PATH accordingly; local dev defaults to "/".
    base: process.env.VITE_BASE_PATH || '/',
    plugins: [react(), tailwindcss(), siteContent(), decapAdmin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled via the DISABLE_HMR environment variable.
      // Do not modify: file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
