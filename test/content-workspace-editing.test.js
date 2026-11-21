import test from 'node:test';
import assert from 'node:assert/strict';
import { createContentWorkspace, updateWorkspaceDocument, transitionWorkspace } from '../src/content-workspace.js';

test('editing approved workspace revokes publication state',()=>{
  const workspace=createContentWorkspace({title:'Original'});
  transitionWorkspace(workspace,'review');
  transitionWorkspace(workspace,'preview');
  transitionWorkspace(workspace,'approved');
  assert.equal(workspace.workflow.publication_allowed,true);
  updateWorkspaceDocument(workspace,{title:'Alterado'});
  assert.equal(workspace.document.title,'Alterado');
  assert.equal(workspace.workflow.state,'draft');
  assert.equal(workspace.workflow.publication_allowed,false);
});

test('editing an already draft workspace preserves draft state',()=>{
  const workspace=createContentWorkspace({title:'Rascunho'});
  updateWorkspaceDocument(workspace,{contentHtml:'<p>Novo</p>'});
  assert.equal(workspace.workflow.state,'draft');
  assert.equal(workspace.workflow.publication_allowed,false);
});
