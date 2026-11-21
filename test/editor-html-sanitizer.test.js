import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeEditorHtml } from '../src/editor-html-sanitizer.js';

function text(value) { return { nodeType: 3, nodeValue: value }; }
function element(tagName, children = [], attrs = {}) {
  return {
    nodeType: 1, tagName, childNodes: children,
    getAttribute(name) { return attrs[name] ?? null; }
  };
}
function parseFixture(nodes) { return () => ({ childNodes: nodes }); }

test('sanitizer preserves semantic formatting and escapes text', () => {
  const html = sanitizeEditorHtml('', { parseHtml: parseFixture([
    element('p', [text('A < B & C'), element('strong', [text('forte')])]),
    element('ul', [element('li', [text('item')])]),
    element('br')
  ]) });
  assert.equal(html, '<p>A &lt; B &amp; C<strong>forte</strong></p><ul><li>item</li></ul><br>');
});

test('sanitizer drops active subtrees and strips event/style attributes', () => {
  const html = sanitizeEditorHtml('', { parseHtml: parseFixture([
    element('p', [text('ok'), element('img', [], { src: 'x', onerror: 'alert(1)' })], { onclick: 'alert(1)', style: 'color:red' }),
    element('script', [text('alert(2)')]),
    element('iframe', [text('bad')]),
    element('svg', [element('script', [text('bad')])])
  ]) });
  assert.equal(html, '<p>ok</p>');
  assert.doesNotMatch(html, /onerror|onclick|script|iframe|svg|style=/i);
});

test('sanitizer keeps only safe links and removes unsafe URL schemes', () => {
  const html = sanitizeEditorHtml('', { parseHtml: parseFixture([
    element('a', [text('safe')], { href: 'https://example.com/path', target: '_blank', onclick: 'x' }),
    element('a', [text('unsafe')], { href: 'javascript:alert(1)' })
  ]) });
  assert.equal(html, '<a href="https://example.com/path">safe</a>unsafe');
});

test('sanitizer rejects whitespace-obfuscated and non-web URL schemes', () => {
  const html = sanitizeEditorHtml('', { parseHtml: parseFixture([
    element('a', [text('javascript')], { href: ' javascript:alert(1)' }),
    element('a', [text('data')], { href: 'data:text/html,<script>alert(1)</script>' }),
    element('a', [text('vbscript')], { href: 'vbscript:msgbox(1)' }),
    element('a', [text('relative')], { href: '//evil.example/path' }),
    element('a', [text('uppercase safe')], { href: 'HTTPS://example.com/safe' })
  ]) });
  assert.equal(html, 'javascriptdatavbscriptrelative<a href="HTTPS://example.com/safe">uppercase safe</a>');
});

test('sanitizer unwraps unknown formatting but removes dangerous embedded subtrees', () => {
  const html = sanitizeEditorHtml('', { parseHtml: parseFixture([
    element('div', [element('span', [text('conteúdo')]), element('img', [], { src: 'https://example.com/x.png' })]),
    element('math', [element('mtext', [text('não renderizar')])]),
    element('template', [element('p', [text('não renderizar')])]),
    element('p', [text('fim')])
  ]) });
  assert.equal(html, 'conteúdo<p>fim</p>');
});
