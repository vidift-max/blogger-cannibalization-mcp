import test from 'node:test';
import assert from 'node:assert/strict';
import { createSandboxedPreviewDocument } from '../src/editor-preview.js';
function text(nodeValue) { return { nodeType: 3, nodeValue }; }
function element(tagName, children = [], attrs = {}) {
  return { nodeType: 1, tagName, namespaceURI: 'http://www.w3.org/1999/xhtml', childNodes: children,
    getAttribute(name) { return attrs[name] ?? null; } };
}
function withPreviewDom(nodes, callback) {
  const previous = globalThis.DOMParser;
  globalThis.DOMParser = class { parseFromString() { return { body: { childNodes: nodes } }; } };
  try { return callback(); } finally { if (previous === undefined) delete globalThis.DOMParser; else globalThis.DOMParser = previous; }
}
test('preview document sanitizes untrusted content internally and applies restrictive CSP', () => {
  const html = withPreviewDom([
    element('p', [text('Texto seguro')]),
    element('script', [text('alert(2)')]),
    element('img', [], { src: 'x', onerror: 'alert(3)' })
  ], () => createSandboxedPreviewDocument({
    title: 'Preview <script>alert(1)</script>',
    contentHtml: '<p>Texto</p><script>alert(2)</script><img src=x onerror=alert(3)>'
  }));
  assert.ok(html.indexOf('Content-Security-Policy') < html.indexOf('<main>'));
  assert.match(html, /default-src &#39;none&#39;|default-src 'none'/);
  assert.doesNotMatch(html, /<script>|onerror=|<img/i);
  assert.match(html, /<p>Texto seguro<\/p>/);
  assert.match(html, /<title>Preview &lt;script&gt;alert\(1\)&lt;\/script&gt;<\/title>/);
});
test('preview document does not grant external navigation, forms, or base URLs', () => {
  const html = withPreviewDom([element('p', [text('Seguro')])], () => createSandboxedPreviewDocument({ contentHtml: '<p>Seguro</p>' }));
  assert.match(html, /form-action &#39;none&#39;|form-action 'none'/);
  assert.match(html, /base-uri &#39;none&#39;|base-uri 'none'/);
  assert.doesNotMatch(html, /allow-scripts|allow-same-origin/);
});
