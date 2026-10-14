/**
 * Decap CMS admin entry point (bundled by Vite, same as the public site).
 * -----------------------------------------------------------------------
 * This is the only JavaScript loaded by /admin/index.html. Bundling the
 * CMS through Vite (instead of pulling an UMD build from a public CDN)
 * keeps the admin experience self-contained, versioned with the rest of
 * the codebase, and reviewable in pull requests like any other code
 * change.
 */
import CMS from 'decap-cms-app';
import { PREVIEW_CSS } from './previewStyles';
import { AnnouncementPreview, MenuPreview, HoursPreview, BlogPreview } from './previews';

// ---------------------------------------------------------------------
// Brand-matched live preview panes (see src/admin/previews.tsx)
// ---------------------------------------------------------------------
CMS.registerPreviewStyle(PREVIEW_CSS, { raw: true });
CMS.registerPreviewTemplate('announcement', AnnouncementPreview);
CMS.registerPreviewTemplate('menu', MenuPreview);
CMS.registerPreviewTemplate('hours', HoursPreview);
CMS.registerPreviewTemplate('blog', BlogPreview);

// ---------------------------------------------------------------------
// Defense-in-depth content guard
// ---------------------------------------------------------------------
// The authoritative defenses against malicious free-text input are:
//   1. The `pattern` validators declared per-field in /public/admin/config.yml
//      (block raw `<script>` tags / angle brackets at entry time).
//   2. DOMPurify + a restricted tag allow-list at render time for the one
//      field that becomes HTML (blog body) — see src/lib/markdown.ts.
// This listener is an additional, friendly nudge: it warns the editor
// *before* they open a pull request if a field looks like it contains a
// script/HTML injection attempt, so they can fix it immediately rather
// than waiting for code review to catch it.
const DANGEROUS_CONTENT_PATTERN = /<\s*script|on\w+\s*=\s*["']|javascript:/i;

CMS.registerEventListener({
  name: 'prePublish',
  handler: ({ entry }: { entry: any }) => {
    const data = entry.get('data');
    const flaggedFields: string[] = [];
    data.forEach((value: unknown, key: string | undefined) => {
      if (typeof value === 'string' && DANGEROUS_CONTENT_PATTERN.test(value) && key) {
        flaggedFields.push(key);
      }
    });
    if (flaggedFields.length > 0) {
      // eslint-disable-next-line no-alert
      window.alert(
        `Heads up: the field(s) "${flaggedFields.join(', ')}" look like they contain script/HTML ` +
          'code, which is not allowed. Please remove it before publishing.',
      );
    }
  },
});

CMS.init();

// Hide the branded boot splash once Decap has mounted its own UI.
window.addEventListener('load', () => {
  window.setTimeout(() => {
    document.getElementById('sd-boot-splash')?.classList.add('sd-hidden');
  }, 250);
});
