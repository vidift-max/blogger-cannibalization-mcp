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

test('HTML-looking entities from Claude remain inert text after import', () => {
  const result = importClaudeHtmlToWorkspace(
    '<h1>Teste</h1><p>&lt;img src=x onerror=alert(1)&gt; &amp; texto</p>'
  );

  assert.equal(result.ok, true);
  assert.match(result.workspace.document.content_html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(result.workspace.document.content_html, /<p>[^<]*&lt;img[^<]*&gt;/i);
  assert.doesNotMatch(result.workspace.document.content_html, /<img\b/i);
});

test('normalized text cannot inject attributes or active elements into workspace HTML', () => {
  const result = importClaudeHtmlToWorkspace(
    '<h1>Título</h1><p>Texto &quot; onclick=&quot;alert(1) &lt;script&gt;alert(2)&lt;/script&gt;</p>'
  );

  assert.equal(result.ok, true);
  assert.match(result.workspace.document.content_html, /&lt;script&gt;/);
  assert.match(result.workspace.document.content_html, /onclick=/i);
  assert.doesNotMatch(result.workspace.document.content_html, /<script\b/i);
  assert.doesNotMatch(result.workspace.document.content_html, /<p[^>]+onclick=/i);
});
