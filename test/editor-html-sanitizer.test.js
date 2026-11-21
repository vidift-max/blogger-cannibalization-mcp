import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeEditorHtml } from '../src/editor-html-sanitizer.js';

function text(value) { return { nodeType: 3, nodeValue: value }; }
function element(tagName, children = [], attrs = {}) {
  return {
    nodeType: 1, tagName, namespaceURI: 'http://www.w3.org/1999/xhtml', childNodes: children,
    getAttribute(name) { return attrs[name] ?? null; }
  };
}
function sanitizeWithNodes(nodes) {
  const previous = globalThis.DOMParser;
  globalThis.DOMParser = class {
    parseFromString() { return { body: { childNodes: nodes } }; }
  };
  try { return sanitizeEditorHtml('fixture'); }
  finally {
    if (previous === undefined) delete globalThis.DOMParser;
    else globalThis.DOMParser = previous;
  }
}

test('sanitizer preserves semantic formatting and escapes text', () => {
  const html = sanitizeWithNodes([
    element('p', [text('A < B & C'), element('strong', [text('forte')])]),
    element('ul', [element('li', [text('item')])]),
    element('br')
  ]);
  assert.equal(html, '<p>A &lt; B &amp; C<strong>forte</strong></p><ul><li>item</li></ul><br>');
});

test('sanitizer drops active subtrees and strips event/style attributes', () => {
  const html = sanitizeWithNodes([
    element('p', [text('ok'), element('img', [], { src: 'x', onerror: 'alert(1)' })], { onclick: 'alert(1)', style: 'color:red' }),
    element('script', [text('alert(2)')]),
    element('iframe', [text('bad')]),
    element('svg', [element('script', [text('bad')])])
  ]);
  assert.equal(html, '<p>ok</p>');
  assert.doesNotMatch(html, /onerror|onclick|script|iframe|svg|style=/i);
});

test('sanitizer keeps only safe links and removes unsafe URL schemes', () => {
  const html = sanitizeWithNodes([
    element('a', [text('safe')], { href: 'https://example.com/path', target: '_blank', onclick: 'x' }),
    element('a', [text('unsafe')], { href: 'java\\nscript:alert(1)' })
  ]);
  assert.equal(html, '<a href="https://example.com/path">safe</a>unsafe');
});

test('sanitizer rejects whitespace-obfuscated and non-web URL schemes', () => {
  const html = sanitizeWithNodes([
    element('a', [text('javascript')], { href: ' javascript:alert(1)' }),
    element('a', [text('data')], { href: 'data:text/html,<script>alert(1)</script>' }),
    element('a', [text('vbscript')], { href: 'vbscript:msgbox(1)' }),
    element('a', [text('relative')], { href: '//evil.example/path' }),
    element('a', [text('uppercase safe')], { href: 'HTTPS://example.com/safe' })
  ]);
  assert.equal(html, 'javascriptdatavbscriptrelative<a href="https://example.com/safe">uppercase safe</a>');
});

test('sanitizer rejects tabs, newlines, and control characters in URLs', () => {
  const html = sanitizeWithNodes([
    element('a', [text('tab')], { href: 'java\\nscript:alert(1)' }),
    element('a', [text('newline')], { href: 'java\\nscript:alert(1)' }),
    element('a', [text('carriage return')], { href: 'java\\nscript:alert(1)' }),
    element('a', [text('control')], { href: 'https://example.com/\u0007path' }),
    element('a', [text('valid')], { href: 'https://example.com/path' })
  ]);
  assert.equal(html, 'tabnewlinecarriage returncontrol<a href="https://example.com/path">valid</a>');
});

test('sanitizer rejects malformed protocol prefixes and URL-like obfuscation', () => {
  const html = sanitizeWithNodes([
    element('a', [text('encoded')], { href: 'java%73cript:alert(1)' }),
    element('a', [text('colon')], { href: 'java\\u003Ascript:alert(1)' }),
    element('a', [text('fragment')], { href: '#javascript:alert(1)' }),
    element('a', [text('relative path')], { href: '/javascript:alert(1)' }),
    element('a', [text('mailto')], { href: 'mailto:test@example.com' })
  ]);
  assert.equal(html, 'encodedcolonfragmentrelative path<a href="mailto:test@example.com">mailto</a>');
});

test('sanitizer unwraps unknown formatting but removes dangerous embedded subtrees', () => {
  const html = sanitizeWithNodes([
    element('div', [element('span', [text('conteúdo')]), element('img', [], { src: 'https://example.com/x.png' })]),
    element('math', [element('mtext', [text('não renderizar')])]),
    element('template', [element('p', [text('não renderizar')])]),
    element('p', [text('fim')])
  ]);
  assert.equal(html, 'conteúdo<p>fim</p>');
});

test('sanitizer rejects foreign-namespace elements even when their tag names are allowed', () => {
  const foreignParagraph = {
    ...element('p', [text('foreign namespace must not become HTML')]),
    namespaceURI: 'http://www.w3.org/2000/svg'
  };
  const htmlParagraph = element('p', [text('valid HTML')]);
  assert.equal(sanitizeWithNodes([foreignParagraph, htmlParagraph]), '<p>valid HTML</p>');
});

test('sanitizer rejects elements without an explicit HTML namespace', () => {
  const ambiguous = { nodeType: 1, tagName: 'p', childNodes: [text('ambiguous element')] };
  assert.equal(sanitizeWithNodes([ambiguous]), '');
});
