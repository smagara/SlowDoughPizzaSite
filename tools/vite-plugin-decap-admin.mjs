/**
 * Vite plugin: serves the Decap CMS admin UI at /admin.
 *
 * The admin page itself is a static file (public/admin/index.html). This
 * plugin adds the two things Vite does not do on its own:
 *
 *  1. Serves the pinned Decap CMS bundle from node_modules/decap-cms at
 *     /admin/decap-cms.js (dev) and emits it into dist/admin/ (build).
 *     Bundling from npm — rather than a CDN <script> — pins the exact
 *     version, works offline and keeps the site free of third-party origins.
 *
 *  2. Rewrites /admin and /admin/ to /admin/index.html in the dev and
 *     preview servers so the URL behaves the same as it does on GitHub Pages.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

function decapBundlePath() {
  return require.resolve('decap-cms/dist/decap-cms.js');
}

function adminRewrite(base) {
  const prefix = base.replace(/\/$/, '') + '/admin';
  return (req, _res, next) => {
    const url = req.url?.split('?')[0] ?? '';
    if (url === prefix || url === prefix + '/') {
      req.url = prefix + '/index.html' + (req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '');
    }
    next();
  };
}

export default function decapAdminPlugin() {
  let base = '/';

  return {
    name: 'slow-dough:decap-admin',

    configResolved(config) {
      base = config.base || '/';
    },

    configureServer(server) {
      server.middlewares.use(adminRewrite(base));
      const bundleUrl = base.replace(/\/$/, '') + '/admin/decap-cms.js';
      server.middlewares.use((req, res, next) => {
        if (req.url?.split('?')[0] !== bundleUrl) return next();
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache');
        fs.createReadStream(decapBundlePath()).pipe(res);
      });
    },

    configurePreviewServer(server) {
      server.middlewares.use(adminRewrite(base));
    },

    generateBundle() {
      const source = fs.readFileSync(decapBundlePath());
      this.emitFile({ type: 'asset', fileName: 'admin/decap-cms.js', source });
      const license = path.join(path.dirname(decapBundlePath()), 'decap-cms.js.LICENSE.txt');
      if (fs.existsSync(license)) {
        this.emitFile({ type: 'asset', fileName: 'admin/decap-cms.js.LICENSE.txt', source: fs.readFileSync(license) });
      }
    },
  };
}
