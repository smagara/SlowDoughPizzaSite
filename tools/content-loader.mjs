/**
 * Slow Dough content loader + validator.
 *
 * Single source of truth for turning the CMS-editable files in `content/`
 * into the typed object the React app consumes. It is used by:
 *
 *   - tools/vite-plugin-site-content.mjs  (dev server + production build)
 *   - tools/validate-content.mjs          (CI gate on every pull request)
 *
 * The validation here is deliberately strict. Decap CMS already enforces
 * field patterns in the browser, but anything that reaches a pull request
 * (hand edits, API calls, a tampered browser) is re-checked here so that
 * invalid or unsafe content can never be merged or built.
 *
 * Plain ESM JavaScript (no TypeScript) so it runs with `node` directly.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import yaml from 'js-yaml';

// ---------------------------------------------------------------------------
// Security / sanity rules shared by every free-text field
// ---------------------------------------------------------------------------

/** Matches anything that looks like the start of an HTML/XML tag or comment. */
export const HTML_TAG_RE = /<\s*\/?\s*[a-zA-Z!?/]/;
/** Script-ish URL schemes that must never appear anywhere in content. */
export const DANGEROUS_SCHEME_RE = /(javascript|vbscript)\s*:/i;
/** `data:` URLs are only dangerous as link targets (markdown `[x](data:...)`). */
export const DATA_URL_LINK_RE = /\]\(\s*data\s*:/i;
/** ASCII control characters (except tab, LF, CR). */
export const CONTROL_CHAR_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
/** Event-handler attribute fragments, e.g. `onerror=`. */
export const EVENT_HANDLER_RE = /\bon[a-z]+\s*=/i;

export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const LIMITS = Object.freeze({
  shortText: 160,
  mediumText: 400,
  longText: 800,
  markdownBody: 50_000,
  tag: 40,
  maxTags: 6,
  maxItemsPerCategory: 40,
  maxCategories: 12,
  maxTakeaways: 6,
  maxPrice: 500,
});

export class ContentValidationError extends Error {
  /** @param {string[]} problems */
  constructor(problems) {
    super(
      `Content validation failed with ${problems.length} problem(s):\n` +
        problems.map((p) => `  - ${p}`).join('\n'),
    );
    this.name = 'ContentValidationError';
    this.problems = problems;
  }
}

/**
 * Collects problems for one file so that a single run reports everything
 * instead of stopping at the first issue.
 */
class Checker {
  constructor(file) {
    this.file = file;
    /** @type {string[]} */
    this.problems = [];
  }

  fail(field, message) {
    this.problems.push(`${this.file} › ${field}: ${message}`);
  }

  /** Generic free-text rules that apply to every string field. */
  text(field, value, { required = true, max = LIMITS.shortText, allowHtmlLike = false } = {}) {
    if (value === undefined || value === null || value === '') {
      if (required) this.fail(field, 'is required');
      return '';
    }
    if (typeof value !== 'string') {
      this.fail(field, `must be text (got ${typeof value})`);
      return '';
    }
    const trimmed = value.trim();
    if (required && trimmed.length === 0) this.fail(field, 'must not be blank');
    if (trimmed.length > max) this.fail(field, `is too long (${trimmed.length} > ${max} characters)`);
    if (CONTROL_CHAR_RE.test(trimmed)) this.fail(field, 'contains control characters');
    if (!allowHtmlLike && HTML_TAG_RE.test(trimmed)) {
      this.fail(field, 'HTML tags are not allowed (found "<" followed by a tag name)');
    }
    if (DANGEROUS_SCHEME_RE.test(trimmed)) this.fail(field, 'contains a javascript:/vbscript: URL');
    if (EVENT_HANDLER_RE.test(trimmed) && HTML_TAG_RE.test(trimmed)) {
      this.fail(field, 'contains an HTML event handler attribute');
    }
    return trimmed;
  }

  /** Markdown body: same rules, plus link-target checks. */
  markdown(field, value) {
    const text = this.text(field, value, { required: true, max: LIMITS.markdownBody });
    if (DATA_URL_LINK_RE.test(text)) this.fail(field, 'data: URLs are not allowed as link targets');
    return text;
  }

  bool(field, value, fallback = false) {
    if (value === undefined || value === null) return fallback;
    if (typeof value !== 'boolean') {
      this.fail(field, `must be true or false (got ${JSON.stringify(value)})`);
      return fallback;
    }
    return value;
  }

  number(field, value, { min = 0, max = Number.MAX_SAFE_INTEGER, integer = false, required = true } = {}) {
    if (value === undefined || value === null || value === '') {
      if (required) this.fail(field, 'is required');
      return 0;
    }
    const n = typeof value === 'string' ? Number(value) : value;
    if (typeof n !== 'number' || !Number.isFinite(n)) {
      this.fail(field, `must be a number (got ${JSON.stringify(value)})`);
      return 0;
    }
    if (n < min || n > max) this.fail(field, `must be between ${min} and ${max}`);
    if (integer && !Number.isInteger(n)) this.fail(field, 'must be a whole number');
    if (!integer && Math.round(n * 100) !== n * 100) this.fail(field, 'may have at most 2 decimal places');
    return n;
  }

  oneOf(field, value, allowed, fallback) {
    if (value === undefined || value === null || value === '') return fallback;
    if (!allowed.includes(value)) {
      this.fail(field, `must be one of ${allowed.join(', ')} (got ${JSON.stringify(value)})`);
      return fallback;
    }
    return value;
  }

  list(field, value, { required = false, max = 100 } = {}) {
    if (value === undefined || value === null) {
      if (required) this.fail(field, 'is required');
      return [];
    }
    if (!Array.isArray(value)) {
      this.fail(field, 'must be a list');
      return [];
    }
    if (value.length > max) this.fail(field, `has too many entries (${value.length} > ${max})`);
    return value;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function slugify(input) {
  return String(input)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function parseYamlFile(file, raw) {
  try {
    const doc = yaml.load(raw, { schema: yaml.JSON_SCHEMA, filename: file });
    if (doc === null || typeof doc !== 'object' || Array.isArray(doc)) {
      throw new Error('top level must be a mapping');
    }
    return doc;
  } catch (err) {
    throw new ContentValidationError([`${file}: invalid YAML – ${err.message}`]);
  }
}

/** Splits `---\nfront matter\n---\nbody` into { data, body }. */
function parseFrontMatter(file, raw) {
  const normalized = raw.replace(/\r\n?/g, '\n');
  const match = normalized.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) {
    throw new ContentValidationError([`${file}: missing YAML front matter block (--- ... ---)`]);
  }
  return { data: parseYamlFile(file, match[1]), body: match[2] };
}

function formatDisplayDate(isoDate) {
  const [y, m, d] = isoDate.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

function isValidIsoDate(value) {
  if (!DATE_RE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

async function listFiles(dir, ext) {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries
      .filter((e) => e.isFile() && e.name.endsWith(ext) && !e.name.startsWith('.'))
      .map((e) => e.name)
      .sort();
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Per-collection loaders
// ---------------------------------------------------------------------------

const ANNOUNCEMENT_FILE = 'content/settings/announcement.yml';
const HOURS_FILE = 'content/settings/hours.yml';
const MENU_DIR = 'content/menu';
const BLOG_DIR = 'content/blog';

async function loadAnnouncement(root, problems) {
  const file = ANNOUNCEMENT_FILE;
  const raw = await fs.readFile(path.join(root, file), 'utf8');
  const doc = parseYamlFile(file, raw);
  const c = new Checker(file);
  const result = {
    enabled: c.bool('enabled', doc.enabled, true),
    headline: c.text('headline', doc.headline, { max: 120 }),
    detail: c.text('detail', doc.detail, { required: false, max: 120 }),
    style: c.oneOf('style', doc.style, ['standard', 'alert'], 'standard'),
  };
  problems.push(...c.problems);
  return result;
}

async function loadHours(root, problems) {
  const file = HOURS_FILE;
  const raw = await fs.readFile(path.join(root, file), 'utf8');
  const doc = parseYamlFile(file, raw);
  const c = new Checker(file);
  const days = c.list('days', doc.days, { required: true, max: 7 }).map((d, i) => {
    const prefix = `days[${i + 1}]`;
    const isClosed = c.bool(`${prefix}.isClosed`, d?.isClosed, false);
    return {
      day: c.text(`${prefix}.day`, d?.day, { max: 40 }),
      hours: c.text(`${prefix}.hours`, d?.hours, { max: 60 }),
      statusNote: c.text(`${prefix}.statusNote`, d?.statusNote, { required: false, max: 120 }),
      isClosed,
    };
  });
  if (days.length === 0) c.fail('days', 'must list at least one day');
  const result = {
    summary: c.text('summary', doc.summary, { max: 60 }),
    days,
  };
  problems.push(...c.problems);
  return result;
}

async function loadMenu(root, problems) {
  const files = await listFiles(path.join(root, MENU_DIR), '.yml');
  if (files.length === 0) problems.push(`${MENU_DIR}: no menu categories found`);
  if (files.length > LIMITS.maxCategories) {
    problems.push(`${MENU_DIR}: too many categories (${files.length} > ${LIMITS.maxCategories})`);
  }
  const categories = [];
  for (const name of files) {
    const file = `${MENU_DIR}/${name}`;
    const id = name.replace(/\.yml$/, '');
    const c = new Checker(file);
    if (!SLUG_RE.test(id)) c.fail('filename', 'must be lowercase letters, numbers and dashes');
    const doc = parseYamlFile(file, await fs.readFile(path.join(root, file), 'utf8'));
    const seenIds = new Set();
    const items = c
      .list('items', doc.items, { required: true, max: LIMITS.maxItemsPerCategory })
      .map((it, i) => {
        const p = `items[${i + 1}]`;
        const itemName = c.text(`${p}.name`, it?.name, { max: 120 });
        let itemId = slugify(itemName) || `item-${i + 1}`;
        while (seenIds.has(itemId)) itemId = `${itemId}-${i + 1}`;
        seenIds.add(itemId);
        const tags = c
          .list(`${p}.tags`, it?.tags, { max: LIMITS.maxTags })
          .map((t, ti) => c.text(`${p}.tags[${ti + 1}]`, t, { max: LIMITS.tag }))
          .filter(Boolean);
        return {
          id: itemId,
          name: itemName,
          italianName: c.text(`${p}.italianName`, it?.italianName, { required: false, max: 120 }),
          description: c.text(`${p}.description`, it?.description, { max: LIMITS.longText }),
          price: c.number(`${p}.price`, it?.price, { min: 0, max: LIMITS.maxPrice }),
          available: c.bool(`${p}.available`, it?.available, true),
          tags,
          isVegetarian: tags.includes('Vegetarian') || tags.includes('Vegan'),
          isVegan: tags.includes('Vegan'),
        };
      });
    if (items.length === 0) c.fail('items', 'category must contain at least one item');
    categories.push({
      id,
      title: c.text('title', doc.title, { max: 120 }),
      subtitle: c.text('subtitle', doc.subtitle, { required: false, max: LIMITS.mediumText }),
      order: c.number('order', doc.order, { min: 0, max: 999, integer: true, required: false }),
      items,
    });
    problems.push(...c.problems);
  }
  categories.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
  return categories;
}

async function loadBlog(root, problems) {
  const files = await listFiles(path.join(root, BLOG_DIR), '.md');
  const posts = [];
  for (const name of files) {
    const file = `${BLOG_DIR}/${name}`;
    const slug = name.replace(/\.md$/, '');
    const c = new Checker(file);
    if (!SLUG_RE.test(slug)) c.fail('filename', 'must be lowercase letters, numbers and dashes');
    const { data, body } = parseFrontMatter(file, await fs.readFile(path.join(root, file), 'utf8'));

    const dateRaw = typeof data.date === 'string' ? data.date.slice(0, 10) : String(data.date ?? '');
    if (!isValidIsoDate(dateRaw)) c.fail('date', `must be a valid date in YYYY-MM-DD form (got ${JSON.stringify(data.date)})`);

    posts.push({
      id: slug,
      slug,
      title: c.text('title', data.title, { max: LIMITS.shortText }),
      subtitle: c.text('subtitle', data.subtitle, { required: false, max: LIMITS.mediumText }),
      author: c.text('author', data.author, { max: 80 }),
      authorRole: c.text('authorRole', data.authorRole, { required: false, max: 80 }),
      readTime: c.text('readTime', data.readTime, { required: false, max: 30 }),
      date: isValidIsoDate(dateRaw) ? dateRaw : '1970-01-01',
      publishedDate: isValidIsoDate(dateRaw) ? formatDisplayDate(dateRaw) : '',
      artType: c.oneOf('artType', data.artType, ['dough', 'oven'], 'dough'),
      excerpt: c.text('excerpt', data.excerpt, { max: LIMITS.longText }),
      keyTakeaways: c
        .list('keyTakeaways', data.keyTakeaways, { max: LIMITS.maxTakeaways })
        .map((t, i) => c.text(`keyTakeaways[${i + 1}]`, t, { max: LIMITS.mediumText }))
        .filter(Boolean),
      body: c.markdown('body', body),
    });
    problems.push(...c.problems);
  }
  posts.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.slug.localeCompare(b.slug)));
  return posts;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Files/directories the dev server should watch for changes. */
export const CONTENT_PATHS = Object.freeze([ANNOUNCEMENT_FILE, HOURS_FILE, MENU_DIR, BLOG_DIR]);

/**
 * Load and validate every piece of CMS content under `root`.
 * Throws ContentValidationError listing *all* problems found.
 *
 * @param {string} root absolute path to the repository root
 */
export async function loadSiteContent(root) {
  /** @type {string[]} */
  const problems = [];
  const [announcement, hours, menu, posts] = await Promise.all([
    loadAnnouncement(root, problems),
    loadHours(root, problems),
    loadMenu(root, problems),
    loadBlog(root, problems),
  ]);
  if (problems.length > 0) throw new ContentValidationError(problems);
  return { announcement, hours, menu, posts };
}
