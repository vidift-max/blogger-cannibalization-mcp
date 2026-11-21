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

test('ignora palavras comuns em inglês e português na seleção editorial', () => {
  const corpus = [
    {
      id: 1,
      title: 'Credit score changes',
      content_text: 'Credit score rules for families.'
    },
    {
      id: 2,
      title: 'Home cooking ideas',
      content_text: 'New ideas for your home and family.'
    }
  ];

  const result = selectEditorialContext(
    corpus,
    'what is this with the new and your para com uma'
  );

  assert.deepEqual(result.map(item => item.id), []);
});

test('consulta formada apenas por palavras comuns não seleciona documentos', () => {
  const corpus = [
    { id: 1, title: 'Banking rules', content_text: 'Checking accounts and savings.' }
  ];

  const result = selectEditorialContext(corpus, 'what is this for you and your');
  assert.deepEqual(result, []);
});


test('preserva siglas financeiras curtas na seleção editorial', () => {
  const result = selectEditorialContext([
    { id: 1, title: 'IRA contribution limits', content_text: 'Updated IRS guidance for IRA accounts.' },
    { id: 2, title: 'Home buying guide', content_text: 'Mortgage and property basics.' }
  ], 'IRS rules for IRA');

  assert.deepEqual(result.map(item => item.id), [1]);
  assert.ok(result[0].matched_terms.includes('irs'));
  assert.ok(result[0].matched_terms.includes('ira'));
});
