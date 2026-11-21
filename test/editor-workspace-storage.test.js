import test from 'node:test';
import assert from 'node:assert/strict';
import { createContentWorkspace } from '../src/content-workspace.js';
import { serializeWorkspace, deserializeWorkspace, saveWorkspace, loadWorkspace, clearWorkspace, DEFAULT_WORKSPACE_STORAGE_KEY, getWorkspaceStorageKey } from '../src/editor-workspace-storage.js';

function createMemoryStorage() {
  const map = new Map();
  return {
    map,
    setItem: (key, value) => map.set(key, value),
    getItem: key => map.get(key) ?? null,
    removeItem: key => map.delete(key)
  };
}

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
  const storage=createMemoryStorage();
  const workspace=createContentWorkspace({title:'Persistido'});
  saveWorkspace(workspace,storage);
  assert.equal(loadWorkspace(storage).document.title,'Persistido');
  clearWorkspace(storage);
  assert.equal(loadWorkspace(storage),null);
});

test('storage adapter supports an explicit namespaced key',()=>{
  const storage=createMemoryStorage();
  const workspace=createContentWorkspace({title:'Namespace'});
  saveWorkspace(workspace,storage,'bsi:article');
  assert.equal(storage.map.has('bsi:article'),true);
  assert.equal(storage.map.has(DEFAULT_WORKSPACE_STORAGE_KEY),false);
  assert.equal(loadWorkspace(storage,'bsi:article').document.title,'Namespace');
  clearWorkspace(storage,'bsi:article');
  assert.equal(loadWorkspace(storage,'bsi:article'),null);
});

test('invalid editorial sections are rejected during restore',()=>{
  const workspace=createContentWorkspace();
  assert.equal(deserializeWorkspace(JSON.stringify({...workspace,version:1,metadata:null})),null);
  assert.equal(deserializeWorkspace(JSON.stringify({...workspace,version:1,seo_intelligence:null})),null);
});

test('restore rejects malformed document fields and inconsistent publication state',()=>{
  const workspace=createContentWorkspace({title:'Valid'});
  assert.equal(deserializeWorkspace(JSON.stringify({...workspace,version:1,document:{...workspace.document,content_html:42}})),null);
  assert.equal(deserializeWorkspace(JSON.stringify({...workspace,version:1,workflow:{state:'draft',publication_allowed:true}})),null);
  assert.equal(deserializeWorkspace(JSON.stringify({...workspace,version:1,sections:['content',false]})),null);
});

test('article and page workspaces use isolated storage keys',()=>{
  const articleKey=getWorkspaceStorageKey('article');
  const pageKey=getWorkspaceStorageKey('page');
  assert.equal(articleKey,'bsi:content-workspace:article');
  assert.equal(pageKey,'bsi:content-workspace:page');
  assert.notEqual(articleKey,pageKey);
  assert.throws(()=>getWorkspaceStorageKey('comment'),/invalid_document_type/);
  const storage=createMemoryStorage();
  saveWorkspace(createContentWorkspace({documentType:'article',title:'Artigo'}),storage,articleKey);
  saveWorkspace(createContentWorkspace({documentType:'page',title:'Página'}),storage,pageKey);
  assert.equal(loadWorkspace(storage,articleKey).document.title,'Artigo');
  assert.equal(loadWorkspace(storage,pageKey).document.title,'Página');
  clearWorkspace(storage,articleKey);
  assert.equal(loadWorkspace(storage,articleKey),null);
  assert.equal(loadWorkspace(storage,pageKey).document.title,'Página');
});

test('storage adapter reports unavailable storage operations',()=>{
  assert.throws(()=>saveWorkspace(createContentWorkspace(),null),/storage_required/);
  assert.throws(()=>loadWorkspace(null),/storage_required/);
  assert.throws(()=>clearWorkspace({},'workspace'),/storage_required/);
});


test('corrupt saved data is treated as invalid while storage access failures remain distinguishable', () => {
  const corruptStorage = {
    getItem: () => '{"version":1,"document":{"type":"article"}}'
  };
  assert.equal(loadWorkspace(corruptStorage, 'bsi:content-workspace:article'), null);

  const unavailableStorage = {
    getItem: () => { throw new Error('storage_access_denied'); }
  };
  assert.throws(
    () => loadWorkspace(unavailableStorage, 'bsi:content-workspace:article'),
    /storage_access_denied/
  );
});

test('failed persistence operations surface errors and do not claim a successful save', () => {
  const workspace = createContentWorkspace({ title: 'Não perder' });
  const failingStorage = {
    setItem: () => { throw new Error('quota_exceeded'); },
    removeItem: () => { throw new Error('storage_write_denied'); }
  };

  assert.throws(() => saveWorkspace(workspace, failingStorage), /quota_exceeded/);
  assert.throws(() => clearWorkspace(failingStorage), /storage_write_denied/);
  assert.equal(workspace.document.title, 'Não perder');
});
