import test from 'node:test';
import assert from 'node:assert/strict';
import { createSandboxedPreviewDocument } from '../src/editor-preview.js';

test('preview document applies restrictive CSP before untrusted content', () => {
  const html = createSandboxedPreviewDocument({
    title: 'Preview <script>alert(1)</script>',
    contentHtml: '<p>Texto</p><script>alert(2)</script><img src=x onerror=alert(3)>',
    sanitizeHtml: () => '<p>Texto seguro</p>'
  });
  assert.ok(html.indexOf('Content-Security-Policy') < html.indexOf('<main>'));
  assert.match(html, /default-src &#39;none&#39;|default-src 'none'/);
  assert.doesNotMatch(html, /<script>|onerror=/i);
  assert.match(html, /<p>Texto seguro<\/p>/);
  assert.match(html, /<title>Preview &lt;script&gt;alert\(1\)&lt;\/script&gt;<\/title>/);
});

test('preview document does not grant external navigation, forms, or base URLs', () => {
  const html = createSandboxedPreviewDocument({ contentHtml: '<p>Seguro</p>', sanitizeHtml: value => value });
  assert.match(html, /form-action &#39;none&#39;|form-action 'none'/);
  assert.match(html, /base-uri &#39;none&#39;|base-uri 'none'/);
  assert.doesNotMatch(html, /allow-scripts|allow-same-origin/);
});
