import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzePosts } from '../src/analysis.js';
test('identifica títulos e conteúdos semelhantes como possível conflito', () => {
  const out = analyzePosts([
    { id: 1, title: 'Melhores contas digitais para estudantes', content_text: 'Comparação de contas digitais para estudantes e tarifas' },
    { id: 2, title: 'Melhores contas digitais para estudantes', content_text: 'Contas digitais, tarifas e comparação para estudantes' }
  ]);
  assert.ok(out.length > 0);
  assert.ok(out[0].score >= 0.18);
});
test('não sinaliza artigos sem relação textual', () => {
  const out = analyzePosts([
    { id: 1, title: 'Como fazer pão de fermentação natural', content_text: 'Farinha, água e fermento' },
    { id: 2, title: 'Trilhas para caminhar no inverno', content_text: 'Montanhas, botas e neve' }
  ]);
  assert.equal(out.length, 0);
});

test('labels ajudam a sustentar a relação temática sem decidir sozinhas', () => {
  const out = analyzePosts([
    { id: 1, title: 'Guia de contas digitais', labels: ['banking', 'students'], content_text: 'Como escolher uma conta para estudantes' },
    { id: 2, title: 'Melhores contas digitais para estudantes', labels: ['banking', 'students'], content_text: 'Comparação de contas e tarifas para estudantes' }
  ]);
  assert.ok(out.length > 0);
  assert.ok(out[0].shared_topics.includes('banking'));
});

test('diferencia intenção de busca para evitar falso positivo', () => {
  const out = analyzePosts([
    { id: 1, title: 'How to compare checking accounts', content_text: 'steps to compare accounts' },
    { id: 2, title: 'Best checking accounts', content_text: 'comparison of top accounts' }
  ]);
  assert.ok(out.length > 0);
  assert.equal(out[0].intent_a, 'informational_how_to');
  assert.equal(out[0].intent_b, 'commercial_comparison');
  assert.equal(out[0].distinct_intent, true);
});

test('headings entram como evidência de sobreposição estrutural', () => {
  const out = analyzePosts([
    { id: 1, title: 'Credit card guide', content_html: '<h2>Fees</h2><h2>Rewards</h2><p>cards</p>', content_text: 'cards fees rewards' },
    { id: 2, title: 'Best credit cards', content_html: '<h2>Fees</h2><h2>Rewards</h2><p>cards</p>', content_text: 'cards fees rewards' }
  ]);
  assert.ok(out.length > 0);
  assert.equal(out[0].heading_similarity, 1);
});

test('preserva tipo de documento e classifica o conflito', () => {
  const out = analyzePosts([
    { id: 1, document_type: 'article', title: 'Best credit cards', content_text: 'credit cards rewards' },
    { id: 2, document_type: 'page', title: 'Best credit cards', content_text: 'credit cards rewards' }
  ]);
  assert.ok(out.length > 0);
  assert.equal(out[0].posts[0].document_type, 'article');
  assert.equal(out[0].posts[1].document_type, 'page');
  assert.equal(out[0].issue_type, 'search_intent_conflict');
});


test('não confunde termos de tópicos por substring', () => {
  const out = analyzePosts([
    { id: 1, title: 'Debt options for families', content_text: 'Bankruptcy, debt relief and household debt options for families' },
    { id: 2, title: 'Debt options for families', content_text: 'Banking accounts, checking accounts and household debt options for families' }
  ]);
  assert.ok(out.length > 0);
  assert.ok(out[0].shared_topics.includes('debt'));
  assert.ok(!out[0].shared_topics.includes('banking'));
});
