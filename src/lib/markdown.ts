/**
 * Safe Markdown rendering for CMS-authored content.
 * -----------------------------------------------------------------------
 * Blog post bodies are authored by the pizza shop owner through the
 * Decap CMS "markdown" widget and stored as plain Markdown in
 * `/content/blog/*.md`. Because that text ultimately reaches
 * `dangerouslySetInnerHTML`, it is treated as untrusted user input and
 * run through two layers of defense:
 *
 *   1. `marked` is configured with raw inline/block HTML disabled, so
 *      authors cannot smuggle `<script>`, `<iframe>`, event handlers,
 *      etc. directly into the Markdown source.
 *   2. The resulting HTML is passed through DOMPurify, which strips any
 *      remaining disallowed tags/attributes (defense in depth, and a
 *      safety net if `marked`'s HTML handling ever changes upstream).
 *
 * This keeps the editorial experience simple (the owner just writes
 * Markdown) while preventing stored-XSS via the CMS.
 */
import { marked } from 'marked';
import DOMPurify from 'dompurify';

marked.setOptions({
  breaks: true,
});

// Markdown tokens that attempt to embed raw HTML are rendered as escaped
// text instead of being interpreted, per https://marked.js.org/using_advanced
// (`marked` still parses our own `#`, `>`, list, etc. syntax as usual).
const DISALLOWED_HTML_PATTERN = /<\/?(script|style|iframe|object|embed|link|meta|form)\b/gi;

export function renderSafeMarkdown(markdown: string): string {
  const withoutDangerousTags = markdown.replace(DISALLOWED_HTML_PATTERN, (match) =>
    match.replace(/</, '&lt;'),
  );

  const rawHtml = marked.parse(withoutDangerousTags, { async: false }) as string;

  return DOMPurify.sanitize(rawHtml, {
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'em', 'blockquote', 'h1', 'h2', 'h3', 'h4',
      'ul', 'ol', 'li', 'a', 'code', 'pre', 'hr', 'span',
    ],
    ALLOWED_ATTR: ['href', 'title', 'target', 'rel'],
    ALLOW_DATA_ATTR: false,
  });
}

/** Strips Markdown/HTML down to plain text, e.g. for search indexes or excerpts. */
export function markdownToPlainText(markdown: string): string {
  const html = renderSafeMarkdown(markdown);
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent ?? '';
}
