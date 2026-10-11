#!/usr/bin/env node
/**
 * Starts the Vite dev server together with the Decap CMS local proxy
 * (decap-server) so /admin can edit the files in content/ without GitHub.
 *
 *   npm run dev:cms        → proxy in "fs" mode: saves write straight to
 *                            content/, the site hot-reloads, review with git.
 *   npm run dev:cms:git    → proxy in "git" mode: simulates the production
 *                            editorial workflow with local cms/* branches.
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mode = process.argv.includes('--git') ? 'git' : 'fs';
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';

console.log(`\n🍕 Slow Dough — starting Vite + Decap local proxy (MODE=${mode})`);
console.log('   Site:  http://localhost:3000/');
console.log('   Admin: http://localhost:3000/admin/\n');

const procs = [
  spawn(npx, ['decap-server'], {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, MODE: mode, PORT: process.env.DECAP_PORT || '8081', LOG_LEVEL: process.env.LOG_LEVEL || 'info' },
  }),
  spawn(npx, ['vite', '--port=3000', '--host=0.0.0.0'], { cwd: root, stdio: 'inherit', env: process.env }),
];

const stop = () => {
  for (const p of procs) if (!p.killed) p.kill('SIGTERM');
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
for (const p of procs) p.on('exit', (code) => { stop(); process.exit(code ?? 0); });
