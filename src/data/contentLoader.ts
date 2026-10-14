/**
 * Content Loader
 * -----------------------------------------------------------------------
 * Slow Dough's editable content (Daily Menu, Dough Announcement, Store
 * Hours, and Blog posts) lives as plain JSON/Markdown files under
 * `/content` at the repo root. These are the exact same files that the
 * Decap CMS admin UI (`/admin`) reads and writes via GitHub.
 *
 * Using `import.meta.glob(..., { eager: true })` means Vite inlines the
 * content at *build time* -- so every time the GitHub Action rebuilds the
 * site (triggered after a CMS edit is merged to `main`), the freshest
 * content is baked into the static bundle. No runtime fetch, no extra
 * server, no stale cache.
 *
 * Free-text fields authored through the CMS are treated as untrusted
 * input. Anything rendered as HTML (currently only the Markdown blog
 * body) is sanitized with DOMPurify in `markdown.ts`. Plain string
 * fields (menu descriptions, announcement text, etc.) are rendered only
 * as React text children, which React escapes automatically, so they
 * can never be interpreted as HTML/script.
 */
import * as yaml from 'js-yaml';
import {
  BlogPost,
  DailyMenuContent,
  DoughAnnouncement,
  StoreHoursContent,
} from '../types';

// ---------------------------------------------------------------------
// Raw content imports (Vite statically analyzes these glob patterns)
// ---------------------------------------------------------------------
const menuModules = import.meta.glob('/content/menu.json', { eager: true, import: 'default' }) as Record<string, DailyMenuContent>;
const announcementModules = import.meta.glob('/content/announcement.json', { eager: true, import: 'default' }) as Record<string, DoughAnnouncement>;
const hoursModules = import.meta.glob('/content/hours.json', { eager: true, import: 'default' }) as Record<string, StoreHoursContent>;
const blogModules = import.meta.glob('/content/blog/*.md', { eager: true, query: '?raw', import: 'default' }) as Record<string, string>;

function firstValue<T>(modules: Record<string, T>): T {
  const key = Object.keys(modules)[0];
  if (!key) {
    throw new Error('Expected content file was not found.');
  }
  return modules[key];
}

/** Very small, defensive frontmatter splitter for `---\nYAML\n---\nbody`. */
function parseFrontmatter(raw: string): { data: Record<string, unknown>; body: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(raw);
  if (!match) {
    return { data: {}, body: raw };
  }
  const [, frontmatter, body] = match;
  const data = (yaml.load(frontmatter) as Record<string, unknown>) ?? {};
  return { data, body: body.trim() };
}

function slugFromPath(path: string): string {
  const file = path.split('/').pop() ?? path;
  return file.replace(/\.md$/, '');
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

function formatPublishedDate(value: string): string {
  // Decap's `datetime` widget stores ISO dates (YYYY-MM-DD). Render them
  // the same friendly way the original static data did.
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

export function loadDailyMenu(): DailyMenuContent {
  return firstValue(menuModules);
}

export function loadAnnouncement(): DoughAnnouncement {
  return firstValue(announcementModules);
}

export function loadStoreHours(): StoreHoursContent {
  return firstValue(hoursModules);
}

export function loadBlogPosts(): BlogPost[] {
  const posts = Object.entries(blogModules).map(([path, raw]) => {
    const { data, body } = parseFrontmatter(raw);
    const slug = slugFromPath(path);
    const artType = data.artType === 'oven' ? 'oven' : 'dough';

    const post: BlogPost = {
      id: slug,
      slug,
      title: asString(data.title, 'Untitled Post'),
      subtitle: asString(data.subtitle),
      author: asString(data.author, 'Slow Dough Team'),
      authorRole: asString(data.authorRole),
      readTime: asString(data.readTime, '3 min read'),
      publishedDate: formatPublishedDate(asString(data.publishedDate)),
      excerpt: asString(data.excerpt),
      artType,
      bodyMarkdown: body,
      keyTakeaways: asStringArray(data.keyTakeaways),
    };
    return post;
  });

  // Newest first, matching the original curated ordering behavior.
  return posts.sort((a, b) => (a.publishedDate < b.publishedDate ? 1 : -1));
}
