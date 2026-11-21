import test from 'node:test';
import assert from 'node:assert/strict';

import { selectEditorialContext } from '../src/editorial-context.js';

test('seleciona artigos e páginas relevantes por termos editoriais', () => {
  const result = selectEditorialContext([
    {
      id: 1,
      title: 'Como os juros afetam o financiamento',
      url: 'https://example.com/juros',
      document_type: 'article',
      labels: ['juros', 'financiamento'],
      content_text: 'Entenda juros e financiamento para consumidores.'
    },
    {
      id: 2,
      title: 'Guia de cartão de crédito',
      url: 'https://example.com/cartao',
      document_type: 'page',
      labels: ['cartão'],
      content_text: 'Informações gerais sobre cartão.'
    }
  ], 'juros financiamento');

  assert.equal(result.length, 1);
  assert.equal(result[0].id, 1);
  assert.equal(result[0].document_type, 'article');
  assert.ok(result[0].matched_terms.includes('juros'));
});

test('limita a quantidade de contexto retornado', () => {
  const corpus = Array.from({ length: 12 }, (_, id) => ({
    id,
    title: 'Notícia sobre inflação',
    content_text: 'inflação economia mercado',
    url: `https://example.com/${id}`,
    document_type: 'article'
  }));

  const result = selectEditorialContext(corpus, 'inflação', 3);
  assert.equal(result.length, 3);
});
