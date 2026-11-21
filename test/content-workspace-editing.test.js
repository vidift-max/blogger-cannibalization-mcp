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


test('invalid transitions cannot move a draft to approved or published', () => {
  const workspace = createContentWorkspace({ title: 'Sem aprovação' });
  assert.throws(() => transitionWorkspace(workspace, 'approved'), /invalid_workspace_transition:draft->approved/);
  assert.throws(() => transitionWorkspace(workspace, 'published'), /invalid_workspace_transition:draft->published/);
  assert.equal(workspace.workflow.state, 'draft');
  assert.equal(workspace.workflow.publication_allowed, false);
});

test('only a valid preview-to-approved transition enables workspace publication', () => {
  const workspace = createContentWorkspace({ title: 'Fluxo válido' });
  assert.equal(workspace.workflow.publication_allowed, false);
  transitionWorkspace(workspace, 'review');
  assert.equal(workspace.workflow.publication_allowed, false);
  transitionWorkspace(workspace, 'preview');
  assert.equal(workspace.workflow.publication_allowed, false);
  transitionWorkspace(workspace, 'approved');
  assert.equal(workspace.workflow.publication_allowed, true);
});

test('editing after approval revokes workspace publication eligibility', () => {
  const workspace = createContentWorkspace({ title: 'Aprovado' });
  transitionWorkspace(workspace, 'review');
  transitionWorkspace(workspace, 'preview');
  transitionWorkspace(workspace, 'approved');
  updateWorkspaceDocument(workspace, { contentHtml: '<p>Alteração posterior</p>' });
  assert.equal(workspace.workflow.state, 'draft');
  assert.equal(workspace.workflow.publication_allowed, false);
});

test('remote operator cannot publish without explicit user approval', async () => {
  const { createOperatorSession, grantPublishCapability, canOperatorPublish } = await import('../src/operator-capabilities.js');
  const session = createOperatorSession({ remote: true });
  assert.equal(canOperatorPublish(session), false);
  assert.throws(() => grantPublishCapability(session), /explicit_user_approval_required/);
  assert.equal(canOperatorPublish(session), false);
});
