/**
 * A deliberately small Markdown parser for CMS-authored blog posts.
 *
 * Security model
 * --------------
 * Blog bodies are free text typed by a non-technical editor. Instead of
 * converting Markdown to an HTML string and injecting it (which requires a
 * sanitizer and is the classic XSS foot-gun), this module parses Markdown
 * into a tiny AST that <SafeMarkdown> renders with ordinary React elements.
 * Every piece of text becomes a React text node, so `<script>` or
 * `<img onerror=…>` typed into the editor is displayed literally and never
 * executed. Link targets are restricted to an allow-list of URL schemes.
 *
 * Supported syntax (matches the toolbar enabled in public/admin/config.yml):
 *   #/##/### headings, paragraphs, > block quotes, - * + and 1. lists,
 *   **bold**, _italic_, `code`, [text](https://…)
 * Anything else is rendered as plain text.
 */

export type Inline =
  | { type: 'text'; value: string }
  | { type: 'strong'; children: Inline[] }
  | { type: 'em'; children: Inline[] }
  | { type: 'code'; value: string }
  | { type: 'link'; href: string; children: Inline[] };

export type Block =
  | { type: 'heading'; level: 2 | 3; children: Inline[] }
  | { type: 'paragraph'; children: Inline[] }
  | { type: 'quote'; children: Inline[] }
  | { type: 'list'; ordered: boolean; items: Inline[][] };

const SAFE_LINK_RE = /^(https?:\/\/|mailto:|\/(?!\/)|#)/i;

/** Returns the href if it uses an allowed scheme, otherwise null. */
export function safeHref(raw: string): string | null {
  const href = raw.trim().replace(/[\u0000-\u001F\u007F\s]/g, '');
  return SAFE_LINK_RE.test(href) ? href : null;
}

// `\*` style escapes produced by Markdown serialisers.
const UNESCAPE_RE = /\\([\\`*_{}[\]()#+\-.!>~|"'])/g;
function unescape(text: string): string {
  return text.replace(UNESCAPE_RE, '$1');
}

const INLINE_RE =
  /(\*\*|__)(?=\S)([\s\S]+?)(?<=\S)\1|(?<![A-Za-z0-9])(\*|_)(?=\S)([^*_\n]+?)(?<=\S)\3(?![A-Za-z0-9])|`([^`\n]+)`|\[([^\]\n]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/;

export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  let rest = text;
  while (rest.length > 0) {
    const m = INLINE_RE.exec(rest);
    if (!m) {
      out.push({ type: 'text', value: unescape(rest) });
      break;
    }
    if (m.index > 0) out.push({ type: 'text', value: unescape(rest.slice(0, m.index)) });
    if (m[2] !== undefined) {
      out.push({ type: 'strong', children: parseInline(m[2]) });
    } else if (m[4] !== undefined) {
      out.push({ type: 'em', children: parseInline(m[4]) });
    } else if (m[5] !== undefined) {
      out.push({ type: 'code', value: m[5] });
    } else if (m[6] !== undefined) {
      const href = safeHref(m[7]);
      const children = parseInline(m[6]);
      // Unsafe targets degrade to plain text – never a clickable link.
      if (href) out.push({ type: 'link', href, children });
      else out.push(...children);
    }
    rest = rest.slice(m.index + m[0].length);
  }
  return out;
}

const HEADING_RE = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
const QUOTE_RE = /^>\s?(.*)$/;
const UL_RE = /^[-*+]\s+(.*)$/;
const OL_RE = /^\d{1,3}[.)]\s+(.*)$/;

export function parseMarkdown(source: string): Block[] {
  const blocks: Block[] = [];
  const lines = source.replace(/\r\n?/g, '\n').split('\n');

  let paragraph: string[] = [];
  let quote: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;

  const flushParagraph = () => {
    if (paragraph.length) {
      blocks.push({ type: 'paragraph', children: parseInline(paragraph.join(' ').trim()) });
      paragraph = [];
    }
  };
  const flushQuote = () => {
    if (quote.length) {
      blocks.push({ type: 'quote', children: parseInline(quote.join(' ').trim()) });
      quote = [];
    }
  };
  const flushList = () => {
    if (list) {
      blocks.push({ type: 'list', ordered: list.ordered, items: list.items.map((i) => parseInline(i.trim())) });
      list = null;
    }
  };
  const flushAll = () => {
    flushParagraph();
    flushQuote();
    flushList();
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (line.trim() === '') {
      flushAll();
      continue;
    }
    let m: RegExpExecArray | null;
    if ((m = HEADING_RE.exec(line))) {
      flushAll();
      const level: 2 | 3 = m[1].length <= 2 ? 2 : 3;
      blocks.push({ type: 'heading', level, children: parseInline(m[2]) });
    } else if ((m = QUOTE_RE.exec(line))) {
      flushParagraph();
      flushList();
      quote.push(m[1]);
    } else if ((m = UL_RE.exec(line)) || (m = OL_RE.exec(line))) {
      flushParagraph();
      flushQuote();
      const ordered = OL_RE.test(line);
      if (!list || list.ordered !== ordered) {
        flushList();
        list = { ordered, items: [] };
      }
      list.items.push(m[1]);
    } else if (list && /^\s{2,}/.test(rawLine)) {
      // continuation line of a list item
      list.items[list.items.length - 1] += ' ' + line.trim();
    } else if (quote.length && !paragraph.length) {
      // lazy continuation of a block quote
      quote.push(line.trim());
    } else {
      flushQuote();
      flushList();
      paragraph.push(line.trim());
    }
  }
  flushAll();
  return blocks;
}
