#!/usr/bin/env node
/**
 * CI content validator.
 * -----------------------------------------------------------------------
 * Runs in the "PR Build Check" GitHub Action for every Pull Request
 * (including the ones Decap CMS opens automatically). This is a second,
 * independent line of defense beyond Decap's own `pattern` field
 * validators and the app's runtime DOMPurify sanitization:
 *
 *   1. Confirms every JSON content file under /content parses cleanly.
 *   2. Confirms every blog Markdown file has valid YAML frontmatter with
 *      the required keys.
 *   3. Scans all free-text content for obvious script/HTML injection
 *      payloads and fails the build if any are found, so a malicious or
 *      mistaken edit can never reach `main` even if it somehow bypassed
 *      the CMS's client-side validation.
 *
 * Exits non-zero (failing the Action) on any problem.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import * as yaml from 'js-yaml';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONTENT_DIR = path.resolve(__dirname, '..', 'content');

const DANGEROUS_PATTERN = /<\s*script|on\w+\s*=\s*["']|javascript:/i;

let errors = [];

function checkStringsForScripts(value, label) {
  if (typeof value === 'string') {
    if (DANGEROUS_PATTERN.test(value)) {
      errors.push(`${label}: contains disallowed script/HTML-like content.`);
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((v, i) => checkStringsForScripts(v, `${label}[${i}]`));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      checkStringsForScripts(v, `${label}.${k}`);
    }
  }
}

function loadJson(relativePath) {
  const full = path.join(CONTENT_DIR, relativePath);
  try {
    const raw = readFileSync(full, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    errors.push(`${relativePath}: failed to parse JSON (${err.message})`);
    return null;
  }
}

// ---------------------------------------------------------------------
// 1) Daily Menu
// ---------------------------------------------------------------------
const menu = loadJson('menu.json');
if (menu) {
  checkStringsForScripts(menu, 'menu.json');
  if (!Array.isArray(menu.categories) || menu.categories.length === 0) {
    errors.push('menu.json: "categories" must be a non-empty array.');
  } else {
    for (const cat of menu.categories) {
      if (!cat.id || !cat.title) errors.push(`menu.json: category missing id/title: ${JSON.stringify(cat)}`);
      for (const item of cat.items || []) {
        if (!item.id || !item.name) {
          errors.push(`menu.json: item missing id/name in category "${cat.id}".`);
        }
        if (typeof item.price !== 'number' || item.price < 0) {
          errors.push(`menu.json: item "${item.id}" has an invalid price.`);
        }
      }
    }
  }
}

// ---------------------------------------------------------------------
// 2) Dough Announcement
// ---------------------------------------------------------------------
const announcement = loadJson('announcement.json');
if (announcement) {
  checkStringsForScripts(announcement, 'announcement.json');
  for (const key of ['badgeText', 'heroEyebrow', 'heroHeadline', 'heroBody']) {
    if (typeof announcement[key] !== 'string' || !announcement[key].trim()) {
      errors.push(`announcement.json: "${key}" must be a non-empty string.`);
    }
  }
}

// ---------------------------------------------------------------------
// 3) Store Hours
// ---------------------------------------------------------------------
const hours = loadJson('hours.json');
if (hours) {
  checkStringsForScripts(hours, 'hours.json');
  if (!Array.isArray(hours.days) || hours.days.length !== 7) {
    errors.push('hours.json: "days" must contain exactly 7 entries.');
  }
}

// ---------------------------------------------------------------------
// 4) Blog Posts
// ---------------------------------------------------------------------
const blogDir = path.join(CONTENT_DIR, 'blog');
const REQUIRED_FRONTMATTER_KEYS = ['title', 'subtitle', 'author', 'publishedDate', 'excerpt'];

for (const file of readdirSync(blogDir)) {
  if (!file.endsWith('.md')) continue;
  const full = path.join(blogDir, file);
  const raw = readFileSync(full, 'utf-8');
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(raw);
  if (!match) {
    errors.push(`blog/${file}: missing or malformed YAML frontmatter.`);
    continue;
  }
  let data;
  try {
    data = yaml.load(match[1]) ?? {};
  } catch (err) {
    errors.push(`blog/${file}: invalid YAML frontmatter (${err.message})`);
    continue;
  }
  for (const key of REQUIRED_FRONTMATTER_KEYS) {
    if (!data[key]) errors.push(`blog/${file}: frontmatter missing required key "${key}".`);
  }
  checkStringsForScripts(data, `blog/${file} (frontmatter)`);
  checkStringsForScripts(match[2], `blog/${file} (body)`);
}

// ---------------------------------------------------------------------
if (errors.length > 0) {
  console.error('\nContent validation failed:\n');
  for (const e of errors) console.error(`  - ${e}`);
  console.error(`\n${errors.length} problem(s) found.\n`);
  process.exit(1);
}

console.log('Content validation passed: all /content files are well-formed and clean.');
