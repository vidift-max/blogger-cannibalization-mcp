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

test('editor persists and restores the structured workspace locally',()=>{const html=fs.readFileSync(new URL('../public/editor.html', import.meta.url), 'utf8');assert.match(html,/localStorage\.setItem\(STORAGE_KEY,JSON\.stringify\(state\.workspace\)/);assert.match(html,/localStorage\.getItem\(STORAGE_KEY\)/);assert.match(html,/hydrateWorkspace\(loadWorkspace\(\)\)/);assert.match(html,/workspace\.version!==1/);assert.match(html,/state\.operator=createOperatorSession\(\{remote:true\}\)/);assert.match(html,/labelsInput\.addEventListener\('input',syncMetadataToWorkspace\)/);assert.match(html,/permalinkInput\.addEventListener\('input',syncMetadataToWorkspace\)/);assert.match(html,/metaDescriptionInput\.addEventListener\('input',syncMetadataToWorkspace\)/);});


test('editor delegates workspace persistence to the isolated storage adapter',()=>{const html=fs.readFileSync(new URL('../public/editor.html', import.meta.url), 'utf8');assert.match(html,/editor-workspace-storage\.js/);assert.match(html,/persistWorkspace\(state\.workspace/);assert.match(html,/restoreWorkspace\(/);assert.doesNotMatch(html,/JSON\.stringify\(state\.workspace\)/);});