/**
 * Vite plugin: exposes the validated CMS content as the virtual module
 * `virtual:site-content`.
 *
 *   import content from 'virtual:site-content';
 *
 * - At build time the content is validated and inlined as JSON, so a broken
 *   content file fails the build instead of shipping a broken page.
 * - In dev, edits under content/ (e.g. made through the local Decap CMS
 *   proxy) trigger a full reload so the site reflects them immediately.
 */
import path from 'node:path';
import { loadSiteContent, CONTENT_PATHS } from './content-loader.mjs';

const VIRTUAL_ID = 'virtual:site-content';
const RESOLVED_ID = '\0' + VIRTUAL_ID;

export default function siteContentPlugin() {
  /** @type {string} */
  let root = process.cwd();

  return {
    name: 'slow-dough:site-content',

    configResolved(config) {
      root = config.root;
    },

    resolveId(id) {
      return id === VIRTUAL_ID ? RESOLVED_ID : null;
    },

    async load(id) {
      if (id !== RESOLVED_ID) return null;
      const content = await loadSiteContent(root);
      // JSON.stringify output is valid JS; escape U+2028/2029 for safety.
      const json = JSON.stringify(content).replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
      return `export default ${json};`;
    },

    configureServer(server) {
      const watched = CONTENT_PATHS.map((p) => path.resolve(root, p));
      server.watcher.add(watched);
      const onChange = (file) => {
        if (!watched.some((w) => file === w || file.startsWith(w + path.sep))) return;
        const mod = server.moduleGraph.getModuleById(RESOLVED_ID);
        if (mod) server.moduleGraph.invalidateModule(mod);
        server.ws.send({ type: 'full-reload', path: '*' });
      };
      server.watcher.on('add', onChange);
      server.watcher.on('change', onChange);
      server.watcher.on('unlink', onChange);
    },
  };
}
