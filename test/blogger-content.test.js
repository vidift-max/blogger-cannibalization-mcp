import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeBloggerDocument,
  htmlToText,
  contentFingerprint
} from '../src/blogger-content.js';

test('normalizes Blogger articles and pages into one corpus shape', () => {
  const article = normalizeBloggerDocument({
    type: 'article',
    blogger_post_id: '42',
    title: '  How to Save  Money ',
    url: 'https://example.com/p/42',
    content_html: '<h2>Intro</h2><p>Save&nbsp;money.</p>',
    labels: ['Finance', ' Finance '],
    updated_at: '2026-11-20T10:00:00Z'
  });

  assert.equal(article.type, 'article');
  assert.equal(article.source_id, '42');
  assert.equal(article.title, 'How to Save Money');
  assert.equal(article.content_text, 'Intro Save money.');
  assert.deepEqual(article.labels, ['Finance', 'Finance']);
});

test('rejects non-http URLs without rejecting the document', () => {
  const page = normalizeBloggerDocument({
    type: 'page',
    blogger_page_id: '9',
    title: 'About',
    url: 'javascript:alert(1)',
    content_html: '<p>Hello</p>'
  });

  assert.equal(page.type, 'page');
  assert.equal(page.source_id, '9');
  assert.equal(page.url, '');
});

test('htmlToText removes executable/style content', () => {
  assert.equal(
    htmlToText('<script>x()</script><style>.x{}</style><p>Hello</p><li>World</li>'),
    'Hello World'
  );
});

test('fingerprint changes when meaningful source content changes', () => {
  const a = contentFingerprint({
    type: 'article',
    blogger_post_id: '1',
    title: 'A',
    url: 'https://example.com/a',
    content_html: '<p>one</p>'
  });
  const b = contentFingerprint({
    type: 'article',
    blogger_post_id: '1',
    title: 'A',
    url: 'https://example.com/a',
    content_html: '<p>two</p>'
  });

  assert.notEqual(a, b);
});
