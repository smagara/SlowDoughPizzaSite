import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { defineConfig, type Plugin, type ViteDevServer } from 'vite';

// ---------------------------------------------------------------------------
// Environment-specific values (GitHub repo, GitHub Pages URL/base path, Azure
// OAuth host) live in ONE place: /site.config.json. Everything below reads
// from it so that re-pointing the site at a new repo/host is a one-file edit.
// ---------------------------------------------------------------------------
interface SiteConfig {
  github: { repo: string; branch: string };
  site: { url: string; basePath: string };
  oauthProvider: { url: string; azure: { functionAppName: string; region: string } };
}

const siteConfig: SiteConfig = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, 'site.config.json'), 'utf-8'),
);

function normalizeBasePath(basePath: string): string {
  let p = basePath.trim() || '/';
  if (!p.startsWith('/')) p = `/${p}`;
  if (!p.endsWith('/')) p = `${p}/`;
  return p;
}

// Vite's dev server resolves extension-less directory paths (like
// `/admin`) against the SPA's root `index.html` before it checks for a
// matching nested `admin/index.html`. That's fine in production (GitHub
// Pages redirects `/admin` -> `/admin/` and serves the directory's
// index.html), but in dev it would otherwise load the public React app
// instead of the Decap CMS admin UI. This middleware mirrors the
// production redirect so relative URLs inside admin/index.html resolve the
// same way in both environments.
function adminDirectoryIndexFallback(base: string): Plugin {
  const adminDir = `${base}admin`;
  const redirectToSlash = (req: { url?: string }, res: import('http').ServerResponse, next: () => void) => {
    if (req.url === adminDir) {
      res.statusCode = 302;
      res.setHeader('Location', `${adminDir}/`);
      res.end();
      return true;
    }
    if (req.url === `${adminDir}/`) {
      req.url = `${adminDir}/index.html`;
    }
    next();
    return false;
  };
  return {
    name: 'slow-dough-admin-directory-index-fallback',
    configureServer(server: ViteDevServer) {
      server.middlewares.use((req, res, next) => void redirectToSlash(req, res, next));
    },
    // `vite preview` serves the built output with the production base path;
    // mirror the same redirect there so local preview behaves like GitHub Pages.
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => void redirectToSlash(req, res, next));
    },
  };
}

// Renders admin/config.template.yml with values from site.config.json and
//   - serves it at /admin/config.yml during `vite dev`
//   - emits it as dist/admin/config.yml during `vite build`
//   - injects the <link rel="cms-config-url"> tag into admin/index.html with
//     the correct base path, so Decap finds the config both locally and when
//     the site is hosted under a sub-path on GitHub Pages.
function cmsConfigPlugin(base: string): Plugin {
  const templatePath = path.resolve(__dirname, 'admin/config.template.yml');
  const configUrlPath = `${base}admin/config.yml`;

  const render = (): string => {
    const tokens: Record<string, string> = {
      GITHUB_REPO: siteConfig.github.repo,
      GITHUB_BRANCH: siteConfig.github.branch,
      OAUTH_PROVIDER_URL: siteConfig.oauthProvider.url.replace(/\/+$/, ''),
      SITE_URL: siteConfig.site.url.replace(/\/+$/, ''),
      BASE_PATH: base,
    };
    return fs
      .readFileSync(templatePath, 'utf-8')
      .replace(/\{\{([A-Z_]+)\}\}/g, (match, key: string) => (key in tokens ? tokens[key] : match));
  };

  return {
    name: 'slow-dough-cms-config',
    configureServer(server: ViteDevServer) {
      server.watcher.add(templatePath);
      server.middlewares.use((req, res, next) => {
        const pathname = (req.url ?? '').split('?')[0];
        if (pathname === '/admin/config.yml') {
          res.setHeader('Content-Type', 'text/yaml; charset=utf-8');
          res.setHeader('Cache-Control', 'no-store');
          res.end(render());
          return;
        }
        next();
      });
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'admin/config.yml', source: render() });
    },
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        if (!ctx.filename.replace(/\\/g, '/').endsWith('/admin/index.html')) return html;
        return {
          html,
          tags: [
            {
              tag: 'link',
              attrs: { rel: 'cms-config-url', type: 'text/yaml', href: configUrlPath },
              injectTo: 'head',
            },
          ],
        };
      },
    },
  };
}

export default defineConfig(({ command, isPreview }) => {
  // GitHub Pages "project" sites are served under /<repo>/, so production
  // builds (and `vite preview`, which serves the built output) must use that
  // base path. Local dev stays at "/" for convenience
  // (http://localhost:3000/ and http://localhost:3000/admin/).
  const base = command === 'build' || isPreview ? normalizeBasePath(siteConfig.site.basePath) : '/';

  return {
    base,
    plugins: [adminDirectoryIndexFallback(base), cmsConfigPlugin(base), react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    // The public marketing site (index.html) and the Decap CMS admin app
    // (admin/index.html) are built as two independent pages in the same
    // Vite project so the admin bundle can be versioned, linted, and
    // reviewed exactly like the rest of the codebase instead of being
    // pulled from an external CDN at runtime.
    build: {
      rollupOptions: {
        input: {
          main: path.resolve(__dirname, 'index.html'),
          admin: path.resolve(__dirname, 'admin/index.html'),
        },
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
