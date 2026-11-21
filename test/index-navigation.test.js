import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');

test('dashboard new content opens the contextual editor', () => {
  assert.match(html, /id="newContent"/);
  assert.match(html, /\/editor\.html\?type=article/);
});

test('dashboard does not contain duplicated inline application scripts', () => {
  assert.equal((html.match(/<script>/g) || []).length, 1);
});
