import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../public/editor.html', import.meta.url), 'utf8');

test('editor supports article and page context', () => {
  assert.match(html, /URLSearchParams/);
  assert.match(html, /documentType/);
  assert.match(html, /type==='page'/);
});

test('page context hides article-only metadata', () => {
  assert.match(html, /id="articleOnly"/);
});
