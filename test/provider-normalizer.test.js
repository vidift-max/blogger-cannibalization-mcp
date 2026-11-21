import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeProviderArticle } from '../src/provider-normalizer.js';

test('normalizer converts accepted provider output into platform-owned data', () => {
  const result = normalizeProviderArticle({
    article: {
      title: '  Título  ',
      meta_description: 'Meta',
      primary_topic: 'economia',
      search_intent: 'informacional'
    },
    blocks: [
      { type: 'title', content: '  Título  ' },
      { type: 'paragraph', content: ' Texto ' },
      { type: 'unknown', content: 'descartar' }
    ],
    interactions: [
      { type: 'calculator', title: 'Calculadora', data: { value: 1 } }
    ]
  });

  assert.equal(result.ok, true);
  assert.equal(result.article.title, 'Título');
  assert.equal(result.blocks.length, 2);
  assert.equal(result.interactions.length, 1);
  assert.deepEqual(result.related_carousel, []);
});

test('normalizer rejects invalid provider output before assembly', () => {
  const result = normalizeProviderArticle({
    article: { title: 'Teste' },
    blocks: [{ type: 'invented', content: 'x' }]
  });

  assert.equal(result.ok, false);
  assert.ok(result.errors.some(error => error.startsWith('unsupported_block_type')));
});

test('preserva metadados editoriais sem aceitar HTML de fornecedor', () => {
  const out = normalizeProviderArticle({
    article: {
      title: 'T',
      summary: 'Resumo',
      target_query: 'consulta alvo'
    },
    blocks: [{ type: 'paragraph', content: 'Texto' }],
    interactions: []
  });
  assert.equal(out.ok, true);
  assert.equal(out.article.summary, 'Resumo');
  assert.equal(out.article.target_query, 'consulta alvo');
});
