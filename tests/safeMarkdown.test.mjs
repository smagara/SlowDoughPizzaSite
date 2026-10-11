import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMarkdown, parseInline, safeHref } from '../src/lib/safeMarkdown.ts';

test('headings, paragraphs, quotes and lists', () => {
  const blocks = parseMarkdown(`## Heading\n\nPara one\nstill one\n\n> a quote\n\n- a\n- b\n\n1. x\n2. y\n`);
  assert.deepEqual(blocks.map((b) => b.type), ['heading', 'paragraph', 'quote', 'list', 'list']);
  assert.equal(blocks[1].children[0].value, 'Para one still one');
  assert.equal(blocks[3].ordered, false);
  assert.equal(blocks[4].ordered, true);
});

test('inline bold / italic / code / links', () => {
  const nodes = parseInline('**bold** and _it_ and `c` and [site](https://example.com)');
  assert.deepEqual(nodes.map((n) => n.type), ['strong', 'text', 'em', 'text', 'code', 'text', 'link']);
  assert.equal(nodes[6].href, 'https://example.com');
});

test('raw HTML is kept as literal text, never as markup', () => {
  const blocks = parseMarkdown('<script>alert(1)</script> <img src=x onerror=alert(1)>');
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].type, 'paragraph');
  assert.equal(blocks[0].children.length, 1);
  assert.equal(blocks[0].children[0].type, 'text');
  assert.equal(blocks[0].children[0].value, '<script>alert(1)</script> <img src=x onerror=alert(1)>');
});

test('dangerous link schemes degrade to plain text', () => {
  for (const bad of ['javascript:alert(1)', 'JAVASCRIPT:alert(1)', 'data:text/html,hi', 'vbscript:x', '//evil.com', ' java\tscript:alert(1)']) {
    assert.equal(safeHref(bad), null, bad);
    const nodes = parseInline(`[click](${bad})`);
    assert.ok(nodes.every((n) => n.type !== 'link'), `link leaked for ${bad}`);
  }
  assert.equal(safeHref('https://ok.com/a?b=1'), 'https://ok.com/a?b=1');
  assert.equal(safeHref('mailto:hi@slowdough.com'), 'mailto:hi@slowdough.com');
  assert.equal(safeHref('/menu'), '/menu');
  assert.equal(safeHref('#hours'), '#hours');
});

test('intra-word underscores and escapes', () => {
  assert.deepEqual(parseInline('snake_case_name'), [{ type: 'text', value: 'snake_case_name' }]);
  assert.deepEqual(parseInline('1 \\* 2'), [{ type: 'text', value: '1 * 2' }]);
});
