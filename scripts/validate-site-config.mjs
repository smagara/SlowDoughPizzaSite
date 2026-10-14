#!/usr/bin/env node
/**
 * Validates /site.config.json — the single place where the GitHub repo,
 * GitHub Pages URL/base path and Azure OAuth host are configured.
 * Runs in CI (PR check + deploy) and via `npm run validate:config`.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const file = path.resolve(__dirname, '..', 'site.config.json');
const errors = [];

let cfg;
try {
  cfg = JSON.parse(readFileSync(file, 'utf-8'));
} catch (err) {
  console.error(`site.config.json: failed to parse (${err.message})`);
  process.exit(1);
}

const get = (p) => p.split('.').reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), cfg);
const req = (p, test, msg) => {
  const v = get(p);
  if (typeof v !== 'string' || !v.trim()) errors.push(`${p}: required`);
  else if (/REPLACE_ME|example\.com|your-org|<|>/i.test(v)) errors.push(`${p}: still contains a placeholder ("${v}")`);
  else if (test && !test(v)) errors.push(`${p}: ${msg} ("${v}")`);
};

req('github.repo', (v) => /^[\w.-]+\/[\w.-]+$/.test(v), 'must be "owner/repo"');
req('github.branch');
req('site.url', (v) => /^https:\/\/[^\s/]+(\/[^\s]*)?$/.test(v), 'must be an https URL');
req('site.basePath', (v) => v.startsWith('/') && v.endsWith('/'), 'must start and end with "/" (use "/" for a root/custom-domain site)');
req('oauthProvider.url', (v) => /^https:\/\/[^\s/]+$/.test(v), 'must be an https origin with no path or trailing slash');
req('oauthProvider.azure.functionAppName', (v) => /^[a-z0-9-]{2,60}$/i.test(v), 'must be a valid Azure Function App name');

// Cross-checks that catch the most common copy/paste mistakes.
const siteUrl = get('site.url');
const basePath = get('site.basePath');
if (siteUrl && basePath) {
  const sitePath = new URL(siteUrl).pathname.replace(/\/*$/, '/');
  if (sitePath !== basePath) {
    errors.push(`site.basePath ("${basePath}") does not match the path of site.url ("${sitePath}")`);
  }
}
const repo = get('github.repo');
if (siteUrl && repo && /github\.io/.test(siteUrl)) {
  const [owner, name] = repo.split('/');
  const expected = `https://${owner.toLowerCase()}.github.io/${name}`;
  if (siteUrl.replace(/\/$/, '').toLowerCase() !== expected.toLowerCase() && siteUrl.replace(/\/$/, '').toLowerCase() !== `https://${owner.toLowerCase()}.github.io`) {
    errors.push(`site.url ("${siteUrl}") does not look like the GitHub Pages URL for repo "${repo}" (expected ${expected} for a project site)`);
  }
}

if (errors.length) {
  console.error('\nsite.config.json validation failed:\n');
  for (const e of errors) console.error(`  - ${e}`);
  console.error('');
  process.exit(1);
}
console.log(`site.config.json OK: repo=${repo}, site=${siteUrl}, base=${basePath}, oauth=${get('oauthProvider.url')}, functionApp=${get('oauthProvider.azure.functionAppName')}`);
