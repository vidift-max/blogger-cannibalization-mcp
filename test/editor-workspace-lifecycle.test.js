import test from 'node:test';
import assert from 'node:assert/strict';
import { importClaudeHtmlToWorkspace } from '../src/claude-workspace-import.js';
import { transitionWorkspace, updateWorkspaceDocument, canPublishWorkspace } from '../src/content-workspace.js';
import { saveWorkspace, loadWorkspace, getWorkspaceStorageKey } from '../src/editor-workspace-storage.js';

function createMemoryStorage() {
  const values = new Map();
  return {
    setItem: (key, value) => values.set(key, value),
    getItem: key => values.get(key) ?? null,
    removeItem: key => values.delete(key)
  };
}

test('Claude import survives save and reload as an unpublished draft', () => {
  const imported = importClaudeHtmlToWorkspace(
    '<h1>Economia doméstica</h1><p>Introdução do artigo.</p><h2>Planejamento</h2><p>Conteúdo principal.</p>'
  );
  assert.equal(imported.ok, true);

  const storage = createMemoryStorage();
  const key = getWorkspaceStorageKey('article');
  saveWorkspace(imported.workspace, storage, key);

  const restored = loadWorkspace(storage, key);
  assert.equal(restored.document.title, 'Economia doméstica');
  assert.match(restored.document.content_html, /Introdução do artigo/);
  assert.match(restored.document.content_html, /<h2>Planejamento<\/h2>/);
  assert.equal(restored.import.source, 'claude_html_manual');
  assert.equal(restored.workflow.state, 'draft');
  assert.equal(canPublishWorkspace(restored), false);
});

test('editing a restored preview returns it to draft and keeps publication blocked', () => {
  const imported = importClaudeHtmlToWorkspace('<h1>Artigo</h1><p>Texto original.</p>');
  const storage = createMemoryStorage();
  const key = getWorkspaceStorageKey('article');

  transitionWorkspace(imported.workspace, 'review');
  transitionWorkspace(imported.workspace, 'preview');
  saveWorkspace(imported.workspace, storage, key);

  const restored = loadWorkspace(storage, key);
  updateWorkspaceDocument(restored, { title: 'Artigo revisado', contentHtml: '<p>Texto atualizado.</p>' });
  saveWorkspace(restored, storage, key);

  const reloaded = loadWorkspace(storage, key);
  assert.equal(reloaded.document.title, 'Artigo revisado');
  assert.equal(reloaded.document.content_html, '<p>Texto atualizado.</p>');
  assert.equal(reloaded.workflow.state, 'draft');
  assert.equal(reloaded.workflow.publication_allowed, false);
  assert.equal(canPublishWorkspace(reloaded), false);
});

test('page and article drafts persist independently through import, reload and clear', () => {
  const storage = createMemoryStorage();
  const articleKey = getWorkspaceStorageKey('article');
  const pageKey = getWorkspaceStorageKey('page');
  const article = importClaudeHtmlToWorkspace('<h1>Artigo principal</h1><p>Conteúdo do artigo.</p>', { documentType: 'article' });
  const page = importClaudeHtmlToWorkspace('<h1>Sobre o projeto</h1><p>Conteúdo da página.</p>', { documentType: 'page' });

  assert.equal(article.ok, true);
  assert.equal(page.ok, true);
  saveWorkspace(article.workspace, storage, articleKey);
  saveWorkspace(page.workspace, storage, pageKey);

  const restoredArticle = loadWorkspace(storage, articleKey);
  const restoredPage = loadWorkspace(storage, pageKey);
  assert.equal(restoredArticle.document.type, 'article');
  assert.equal(restoredArticle.document.title, 'Artigo principal');
  assert.equal(restoredPage.document.type, 'page');
  assert.equal(restoredPage.document.title, 'Sobre o projeto');

  storage.removeItem(pageKey);
  assert.equal(loadWorkspace(storage, pageKey), null);
  assert.equal(loadWorkspace(storage, articleKey).document.title, 'Artigo principal');
  assert.equal(canPublishWorkspace(restoredArticle), false);
  assert.equal(canPublishWorkspace(restoredPage), false);
});
