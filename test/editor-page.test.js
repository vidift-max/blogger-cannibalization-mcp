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

test('editor persists and restores the structured workspace locally',()=>{const html=fs.readFileSync(new URL('../public/editor.html', import.meta.url), 'utf8');assert.match(html,/localStorage\.setItem\(STORAGE_KEY,JSON\.stringify\(state\.workspace\)/);assert.match(html,/localStorage\.getItem\(STORAGE_KEY\)/);assert.match(html,/hydrateWorkspace\(loadWorkspace\(\)\)/);});
