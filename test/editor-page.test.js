import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('editor page exposes contextual content tools and approval gate', () => {
  const html = fs.readFileSync(new URL('../public/editor.html', import.meta.url), 'utf8');
  assert.match(html, /SEO Intelligence/);
  assert.match(html, /Pré-visualizar/);
  assert.match(html, /Publicar/);
  assert.match(html, /disabled/);
  assert.match(html, /Aguardando revisão e aprovação/);
});
