import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildIndex, analyzeCannibalization, classifyIntent, extractKeywords } from '../src/analysis.js';

const arts = [
  { id: '1', title: '2027 Tax Brackets & Standard Deduction: What the IRS Changed', url: 'u1',
    labels: ['Taxes', 'IRS'], keywords: ['2027 tax brackets', 'standard deduction', 'irs'],
    textClean: 'tax brackets 2027 standard deduction federal income tax marginal rate what the irs changed child tax credit eitc' },
  { id: '2', title: 'How to Save an Emergency Fund', url: 'u2',
    labels: ['Saving'], keywords: ['emergency fund', 'saving money'],
    textClean: 'emergency fund savings account budgeting tips save money' },
];

test('canibalização alta para pauta quase idêntica a artigo existente', () => {
  const r = analyzeCannibalization(buildIndex(arts),
    '2027 standard deduction amounts and new tax brackets');
  assert.ok(['high', 'critical'].includes(r.riskLevel), `esperado high+, veio ${r.riskLevel}`);
  assert.equal(r.competitors[0].id, '1');
  assert.equal(r.competitors[0].sameIntent, true);
  assert.ok(r.conflictingKeywords.length > 0);
});

test('tópico distante tem risco baixo', () => {
  const r = analyzeCannibalization(buildIndex(arts), 'how to start investing in index funds');
  assert.equal(r.riskLevel, 'low');
});

test('intenção transacional vs informacional', () => {
  assert.equal(classifyIntent('best mortgage rates today'), 'transactional');
  assert.equal(classifyIntent('what are mortgage rates'), 'informational');
});

test('extractKeywords gera bigramas', () => {
  const kws = extractKeywords('mortgage rates mortgage rates for first time home buyers');
  assert.ok(kws.includes('mortgage rates'));
});