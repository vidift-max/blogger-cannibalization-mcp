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
