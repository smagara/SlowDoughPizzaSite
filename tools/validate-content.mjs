#!/usr/bin/env node
/**
 * CI / pre-commit gate: validates everything under content/.
 *
 *   npm run validate:content
 *
 * Exits non-zero (and prints every problem) if any file is malformed,
 * exceeds size limits, or contains HTML / script-like text.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSiteContent, ContentValidationError } from './content-loader.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

try {
  const content = await loadSiteContent(root);
  const itemCount = content.menu.reduce((n, c) => n + c.items.length, 0);
  console.log('✔ Content is valid');
  console.log(`  • announcement: ${content.announcement.enabled ? 'enabled' : 'disabled'} – "${content.announcement.headline}"`);
  console.log(`  • hours: ${content.hours.days.length} day(s)`);
  console.log(`  • menu: ${content.menu.length} categor${content.menu.length === 1 ? 'y' : 'ies'}, ${itemCount} item(s)`);
  console.log(`  • blog: ${content.posts.length} post(s)`);
} catch (err) {
  if (err instanceof ContentValidationError) {
    console.error(`✖ ${err.message}`);
    process.exit(1);
  }
  throw err;
}
