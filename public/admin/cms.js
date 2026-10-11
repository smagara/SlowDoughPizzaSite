/* global CMS, h, createClass */
/**
 * Slow Dough Pizza Co. — Decap CMS customisation.
 *
 * Loaded after decap-cms.js (see index.html). Three responsibilities:
 *
 *   1. Preview templates that render each collection the way the live site
 *      does (cream background, Georgia headings, terracotta accent), so the
 *      manager sees roughly what customers will see before saving.
 *   2. A `preSave` guard that refuses to save any text containing HTML tags
 *      or script URLs. Field `pattern`s in config.yml catch these first with
 *      per-field messages; this is the belt to those braces.
 *   3. Small quality-of-life tweaks (page title).
 *
 * Plain browser JavaScript on purpose: no build step, no framework coupling,
 * and it can be edited without touching the React app.
 */
(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // 1. Styling for the preview pane (runs inside Decap's preview iframe)
  // ---------------------------------------------------------------------------
  CMS.registerPreviewStyle(new URL('./preview.css', document.baseURI).href);

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  function data(entry, key, fallback) {
    const value = entry.getIn(['data', key]);
    if (value === undefined || value === null) return fallback;
    return value && typeof value.toJS === 'function' ? value.toJS() : value;
  }

  function price(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return '$—';
    return '$' + (Number.isInteger(n) ? n.toString() : n.toFixed(2));
  }

  function tagClass(tag) {
    if (tag === 'Vegetarian' || tag === 'Vegan') return 'sd-tag sd-tag--green';
    if (tag === 'House Favorite') return 'sd-tag sd-tag--accent';
    return 'sd-tag';
  }

  // ---------------------------------------------------------------------------
  // Preview: Dough announcement (file collection "settings" → "announcement")
  // ---------------------------------------------------------------------------
  const AnnouncementPreview = createClass({
    render: function () {
      const e = this.props.entry;
      const enabled = data(e, 'enabled', true);
      const style = data(e, 'style', 'standard');
      const headline = data(e, 'headline', '');
      const detail = data(e, 'detail', '');
      return h(
        'div',
        { className: 'sd-preview' },
        h('p', { className: 'sd-preview__note' }, 'How the banner will look at the top of every page:'),
        enabled
          ? h(
              'div',
              { className: 'sd-banner' + (style === 'alert' ? ' sd-banner--alert' : '') },
              h('span', { className: 'sd-banner__dot' }),
              h('span', null, headline || 'Headline…'),
              detail ? h('span', { className: 'sd-banner__sep' }, '•') : null,
              detail ? h('span', { className: 'sd-banner__detail' }, detail) : null,
            )
          : h('div', { className: 'sd-banner sd-banner--off' }, 'Banner hidden (switch "Show the banner" on to display it)'),
        h('div', { className: 'sd-fake-header' }, h('span', { className: 'sd-brand' }, 'Slow Dough'), h('span', { className: 'sd-brand__sub' }, 'Artisan Pizza Co. • 72H Aged')),
      );
    },
  });

  // ---------------------------------------------------------------------------
  // Preview: Hours
  // ---------------------------------------------------------------------------
  const HoursPreview = createClass({
    render: function () {
      const e = this.props.entry;
      const days = data(e, 'days', []) || [];
      return h(
        'div',
        { className: 'sd-preview' },
        h('div', { className: 'sd-eyebrow' }, 'Visit the Pizzeria'),
        h('h2', { className: 'sd-h2' }, 'Store Hours & Location'),
        h('p', { className: 'sd-preview__note' }, 'Header badge: ', h('span', { className: 'sd-pill' }, '🕓 ' + (data(e, 'summary', '') || '…'))),
        h(
          'div',
          { className: 'sd-card' },
          h('div', { className: 'sd-card__title' }, 'Weekly Schedule'),
          days.map(function (d, i) {
            return h(
              'div',
              { className: 'sd-hours-row' + (d.isClosed ? ' sd-hours-row--closed' : ''), key: i },
              h('div', null, h('strong', { className: 'sd-serif' }, d.day || '—'), d.statusNote ? h('span', { className: 'sd-hours-row__note' }, ' (' + d.statusNote + ')') : null),
              h('div', { className: 'sd-hours-row__time' }, d.hours || ''),
            );
          }),
        ),
      );
    },
  });

  // ---------------------------------------------------------------------------
  // Preview: Menu category
  // ---------------------------------------------------------------------------
  const MenuCategoryPreview = createClass({
    render: function () {
      const e = this.props.entry;
      const items = data(e, 'items', []) || [];
      const title = data(e, 'title', '');
      return h(
        'div',
        { className: 'sd-preview' },
        h('div', { className: 'sd-eyebrow' }, 'Seasonal Artisanal Selections'),
        h('h2', { className: 'sd-h2' }, 'Our Daily Menu'),
        h('p', { className: 'sd-preview__note' }, 'Filter button: ', h('span', { className: 'sd-pill sd-pill--dark' }, (title || 'Category').split('(')[0].trim())),
        h(
          'div',
          { className: 'sd-category-head' },
          h('h3', { className: 'sd-h3' }, title || 'Category title…'),
          h('p', { className: 'sd-muted' }, data(e, 'subtitle', '')),
        ),
        h(
          'div',
          { className: 'sd-grid' },
          items.map(function (it, i) {
            const tags = Array.isArray(it.tags) ? it.tags : [];
            const available = it.available !== false;
            return h(
              'div',
              { className: 'sd-item' + (available ? '' : ' sd-item--soldout'), key: i },
              h(
                'div',
                { className: 'sd-item__row' },
                h('div', null, h('h4', { className: 'sd-item__name' }, it.name || 'Item name…'), it.italianName ? h('div', { className: 'sd-item__italian' }, it.italianName) : null),
                h('div', { className: 'sd-item__price' }, price(it.price)),
              ),
              h('p', { className: 'sd-item__desc' }, it.description || ''),
              tags.length || !available
                ? h(
                    'div',
                    { className: 'sd-item__tags' },
                    !available ? h('span', { className: 'sd-tag sd-tag--dark' }, 'Sold Out Today') : null,
                    tags.map(function (t, j) {
                      return h('span', { className: tagClass(t), key: j }, (t === 'Vegetarian' || t === 'Vegan' ? '🌿 ' : '') + t);
                    }),
                  )
                : null,
            );
          }),
        ),
      );
    },
  });

  // ---------------------------------------------------------------------------
  // Preview: Blog post
  // ---------------------------------------------------------------------------
  const BlogPostPreview = createClass({
    render: function () {
      const e = this.props.entry;
      const takeaways = data(e, 'keyTakeaways', []) || [];
      const rawDate = data(e, 'date', '');
      let dateLabel = '';
      if (rawDate) {
        const d = new Date(String(rawDate).slice(0, 10) + 'T00:00:00Z');
        dateLabel = isNaN(d) ? String(rawDate) : d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
      }
      return h(
        'div',
        { className: 'sd-preview' },
        h('div', { className: 'sd-eyebrow' }, "The Baker's Journal • Slow Dough Pizza Co."),
        h(
          'div',
          { className: 'sd-meta' },
          'By ' + (data(e, 'author', '') || '…') + (data(e, 'authorRole', '') ? ', ' + data(e, 'authorRole', '') : ''),
          ' • ',
          dateLabel || 'date…',
          ' • ',
          data(e, 'readTime', '') || '',
        ),
        h('h1', { className: 'sd-h1' }, data(e, 'title', '') || 'Post title…'),
        data(e, 'subtitle', '') ? h('p', { className: 'sd-subtitle' }, data(e, 'subtitle', '')) : null,
        h('p', { className: 'sd-excerpt' }, data(e, 'excerpt', '')),
        takeaways.length
          ? h(
              'div',
              { className: 'sd-takeaways' },
              h('div', { className: 'sd-takeaways__title' }, 'Key Takeaways for the Curious Eater:'),
              h(
                'ul',
                null,
                takeaways.map(function (t, i) {
                  return h('li', { key: i }, t);
                }),
              ),
            )
          : null,
        h('div', { className: 'sd-body' }, this.props.widgetFor('body')),
      );
    },
  });

  CMS.registerPreviewTemplate('announcement', AnnouncementPreview);
  CMS.registerPreviewTemplate('hours', HoursPreview);
  CMS.registerPreviewTemplate('menu', MenuCategoryPreview);
  CMS.registerPreviewTemplate('blog', BlogPostPreview);

  // ---------------------------------------------------------------------------
  // 2. Save-time guard against HTML / script content
  // ---------------------------------------------------------------------------
  // Keep these in sync with tools/content-loader.mjs (the CI gate).
  const HTML_TAG_RE = /<\s*\/?\s*[a-zA-Z!?/]/;
  const DANGEROUS_SCHEME_RE = /(javascript|vbscript)\s*:/i;
  const DATA_URL_LINK_RE = /\]\(\s*data\s*:/i;
  const CONTROL_CHAR_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

  function findUnsafeText(value, path, problems) {
    if (typeof value === 'string') {
      if (HTML_TAG_RE.test(value)) problems.push(path + ': HTML tags are not allowed');
      if (DANGEROUS_SCHEME_RE.test(value)) problems.push(path + ': script URLs are not allowed');
      if (DATA_URL_LINK_RE.test(value)) problems.push(path + ': data: links are not allowed');
      if (CONTROL_CHAR_RE.test(value)) problems.push(path + ': contains control characters');
    } else if (Array.isArray(value)) {
      value.forEach(function (v, i) {
        findUnsafeText(v, path + '[' + (i + 1) + ']', problems);
      });
    } else if (value && typeof value === 'object') {
      Object.keys(value).forEach(function (k) {
        findUnsafeText(value[k], path ? path + '.' + k : k, problems);
      });
    }
  }

  CMS.registerEventListener({
    name: 'preSave',
    handler: function (payload) {
      const entryData = payload.entry.get('data');
      const plain = entryData && typeof entryData.toJS === 'function' ? entryData.toJS() : entryData;
      const problems = [];
      findUnsafeText(plain, '', problems);
      if (problems.length) {
        // Throwing aborts the save; Decap shows the message in a toast.
        throw new Error('Unsafe text was not saved — ' + problems.join('; '));
      }
      // Normalise whitespace in plain string fields so diffs stay clean.
      return entryData.map(function (v) {
        return typeof v === 'string' ? v.replace(/[ \t]+$/gm, '').replace(/\r\n?/g, '\n') : v;
      });
    },
  });

  // ---------------------------------------------------------------------------
  // 3. Cosmetics
  // ---------------------------------------------------------------------------
  document.title = 'Slow Dough Pizza Co. — Content Manager';
})();
