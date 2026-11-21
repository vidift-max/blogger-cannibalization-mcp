import test from 'node:test';
import assert from 'node:assert/strict';
import { createContentWorkspace } from '../src/content-workspace.js';
import { serializeWorkspace, deserializeWorkspace, saveWorkspace, loadWorkspace, clearWorkspace, DEFAULT_WORKSPACE_STORAGE_KEY } from '../src/editor-workspace-storage.js';

test('workspace storage round-trips editorial data without operator session',()=>{
  const workspace=createContentWorkspace({title:'Teste',contentHtml:'<p>Conteúdo</p>',metadata:{labels:['seo']}});
  workspace.operator={user_approved:true,capabilities:['publish_approved_content']};
  const restored=deserializeWorkspace(serializeWorkspace(workspace));
  assert.equal(restored.document.title,'Teste');
  assert.equal(restored.document.content_html,'<p>Conteúdo</p>');
  assert.deepEqual(restored.metadata.labels,['seo']);
  assert.equal('operator' in restored,false);
});

test('invalid stored workspace is rejected',()=>{
  assert.equal(deserializeWorkspace('{bad json'),null);
  assert.equal(deserializeWorkspace(JSON.stringify({version:2})),null);
  assert.equal(deserializeWorkspace(JSON.stringify({version:1,document:{}})),null);
});

test('storage adapter saves, loads and clears workspace',()=>{
  const map=new Map();
  const storage={setItem:(k,v)=>map.set(k,v),getItem:k=>map.get(k)||null,removeItem:k=>map.delete(k)};
  const workspace=createContentWorkspace({title:'Persistido'});
  saveWorkspace(workspace,storage);
  assert.equal(loadWorkspace(storage).document.title,'Persistido');
  clearWorkspace(storage);
  assert.equal(loadWorkspace(storage),null);
});


test('storage adapter supports an explicit namespaced key',()=>{const map=new Map();const storage={setItem:(k,v)=>map.set(k,v),getItem:k=>map.get(k)||null,removeItem:k=>map.delete(k)};const workspace=createContentWorkspace({title:'Namespace'});saveWorkspace(workspace,storage,'bsi:article');assert.equal(map.has('bsi:article'),true);assert.equal(map.has(DEFAULT_WORKSPACE_STORAGE_KEY),false);assert.equal(loadWorkspace(storage,'bsi:article').document.title,'Namespace');clearWorkspace(storage,'bsi:article');assert.equal(loadWorkspace(storage,'bsi:article'),null);});
