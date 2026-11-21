import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeClaudeHtml } from '../src/claude-html-normalizer.js';

test('normaliza HTML puro do Claude em blocos pertencentes à plataforma', () => {
  const result = normalizeClaudeHtml(
    '<h1>Título novo</h1><p>Introdução.</p><h2>Primeiro ponto</h2><p>Detalhes.</p>'
  );

  assert.equal(result.ok, true);
  assert.equal(result.article.title, 'Título novo');
  assert.deepEqual(result.blocks.map(block => block.type), [
    'title',
    'paragraph',
    'heading_2',
    'paragraph'
  ]);
});

test('recusa HTML com JavaScript antes da distribuição', () => {
  const result = normalizeClaudeHtml(
    '<h1>Título</h1><script>alert(1)</script><p>Texto</p>'
  );

  assert.equal(result.ok, false);
  assert.ok(result.errors.includes('javascript_forbidden'));
});
