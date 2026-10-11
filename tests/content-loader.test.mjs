import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSiteContent, ContentValidationError } from '../tools/content-loader.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function fixture(mutate) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'slowdough-'));
  await fs.cp(path.join(repoRoot, 'content'), path.join(dir, 'content'), { recursive: true });
  await mutate(dir);
  return dir;
}

async function expectProblems(dir, ...needles) {
  await assert.rejects(loadSiteContent(dir), (err) => {
    assert.ok(err instanceof ContentValidationError, String(err));
    for (const n of needles) assert.ok(err.problems.some((p) => p.includes(n)), `expected "${n}" in:\n${err.problems.join('\n')}`);
    return true;
  });
}

test('repository content is valid and sorted', async () => {
  const c = await loadSiteContent(repoRoot);
  assert.equal(c.menu[0].id, 'neapolitan-pies');
  assert.ok(c.posts[0].date >= c.posts[1].date);
  assert.equal(c.posts[0].publishedDate, 'September 14, 2026');
  assert.equal(c.menu[0].items[0].id, 'margherita-verace-d-o-p');
  assert.equal(c.menu[0].items[1].isVegan, true);
});

test('rejects script tags in the announcement', async () => {
  const dir = await fixture((d) => fs.writeFile(path.join(d, 'content/settings/announcement.yml'),
    `enabled: true\nheadline: "<script>alert(1)</script>"\ndetail: ok\nstyle: standard\n`));
  await expectProblems(dir, 'headline', 'HTML tags are not allowed');
});

test('rejects javascript: urls, bad prices, bad dates and unknown art types', async () => {
  const dir = await fixture(async (d) => {
    await fs.writeFile(path.join(d, 'content/menu/bad.yml'),
      `title: Bad\norder: 9\nitems:\n  - name: Thing\n    description: "see javascript:alert(1)"\n    price: -5\n    tags: [a]\n`);
    await fs.writeFile(path.join(d, 'content/blog/2020-13-45-oops.md'),
      `---\ntitle: T\nauthor: A\ndate: '2020-13-45'\nartType: cat\nexcerpt: E\n---\n\nBody with [x](data:text/html,hi)\n`);
  });
  await expectProblems(dir, 'javascript:', 'price: must be between', 'date: must be a valid date', 'artType: must be one of', 'data: URLs');
});

test('rejects bad filenames and missing required fields', async () => {
  const dir = await fixture(async (d) => {
    await fs.writeFile(path.join(d, 'content/menu/Bad Name.yml'), `title: x\nitems:\n  - name: ''\n    description: ''\n    price: 1\n`);
  });
  await expectProblems(dir, 'filename', 'items[1].name: is required', 'items[1].description: is required');
});

test('rejects malformed YAML with a useful message', async () => {
  const dir = await fixture((d) => fs.writeFile(path.join(d, 'content/settings/hours.yml'), `summary: [unclosed\n`));
  await expectProblems(dir, 'invalid YAML');
});
