import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CONTENT_WORKSPACE_SECTIONS,
  canPublishWorkspace,
  createContentWorkspace,
  transitionWorkspace
} from '../src/content-workspace.js';

test('workspace separates content, metadata and SEO tools by document context', () => {
  const article = createContentWorkspace({ documentType: 'article' });
  const page = createContentWorkspace({ documentType: 'page' });

  assert.ok(article.sections.includes('content'));
  assert.ok(article.sections.includes('metadata'));
  assert.ok(article.sections.includes('seo_intelligence'));
  assert.deepEqual(article.sections, CONTENT_WORKSPACE_SECTIONS.article);
  assert.deepEqual(page.sections, CONTENT_WORKSPACE_SECTIONS.page);
});

test('new workspace is a draft and cannot publish', () => {
  const workspace = createContentWorkspace({
    documentId: 7,
    title: 'Teste',
    contentHtml: '<p>Conteúdo</p>'
  });

  assert.equal(workspace.workflow.state, 'draft');
  assert.equal(workspace.workflow.publication_allowed, false);
  assert.equal(canPublishWorkspace(workspace), false);
});

test('workflow requires review, preview and explicit approval before publication', () => {
  const workspace = createContentWorkspace();

  transitionWorkspace(workspace, 'review');
  transitionWorkspace(workspace, 'preview');

  assert.equal(canPublishWorkspace(workspace), false);

  transitionWorkspace(workspace, 'approved');
  assert.equal(canPublishWorkspace(workspace), true);

  transitionWorkspace(workspace, 'published');
  assert.equal(workspace.workflow.publication_allowed, false);
});

test('invalid direct publication from draft is rejected', () => {
  const workspace = createContentWorkspace();

  assert.throws(
    () => transitionWorkspace(workspace, 'published'),
    /invalid_workspace_transition/
  );
});
