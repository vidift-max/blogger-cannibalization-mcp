import test from 'node:test';
import assert from 'node:assert/strict';
import { importClaudeHtmlToWorkspace } from '../src/claude-workspace-import.js';

test('manual Claude HTML becomes a draft workspace without publication permission', () => {
  const result = importClaudeHtmlToWorkspace(
    '<h1>Economia</h1><p>Texto inicial.</p><h2>Contexto</h2><p>Mais conteúdo.</p>'
  );

  assert.equal(result.ok, true);
  assert.equal(result.workspace.document.title, 'Economia');
  assert.match(result.workspace.document.content_html, /Texto inicial/);
  assert.match(result.workspace.document.content_html, /<h2>Contexto<\/h2>/);
  assert.equal(result.workspace.workflow.state, 'draft');
  assert.equal(result.workspace.workflow.publication_allowed, false);
  assert.equal(result.workspace.import.source, 'claude_html_manual');
});
