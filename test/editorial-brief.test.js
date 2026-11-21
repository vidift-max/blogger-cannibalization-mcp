import test from 'node:test';
import assert from 'node:assert/strict';

import { buildEditorialBrief } from '../src/editorial-brief.js';

test('monta briefing com corpus relevante e conflitos de intenção', () => {
  const corpus = [
    {
      id: 1,
      title: 'Juros e financiamento',
      url: 'https://example.com/juros',
      document_type: 'article',
      labels: ['juros', 'financiamento'],
      content_text: 'Como juros afetam financiamentos.'
    },
    {
      id: 2,
      title: 'Cartão de crédito',
      url: 'https://example.com/cartao',
      document_type: 'page',
      labels: ['cartão'],
      content_text: 'Informações sobre cartões.'
    }
  ];

  const result = buildEditorialBrief({
    corpus,
    query: 'juros financiamento',
    sourceTitle: 'Mudança nos juros'
  });

  assert.equal(result.relevant_documents[0].id, 1);
  assert.ok(Array.isArray(result.cannibalization_findings));
  assert.ok(Array.isArray(result.occupied_topics));
  assert.ok(Array.isArray(result.high_risk_document_ids));
});


test('lista apenas documentos relevantes entre os IDs de alto risco', () => {
  const corpus = [
    {
      id: 10,
      title: 'Mortgage refinance options and rates',
      content_text: 'Compare mortgage refinance options and current rates.'
    },
    {
      id: 11,
      title: 'Mortgage refinance options and rates',
      content_text: 'A detailed guide to mortgage refinance options and rates.'
    }
  ];

  const result = buildEditorialBrief({
    corpus,
    query: 'mortgage refinance',
    limit: 1
  });

  assert.equal(result.relevant_documents.length, 1);
  assert.equal(result.relevant_documents[0].id, 10);
  assert.ok(result.cannibalization_findings.some(finding => finding.risk === 'HIGH'));
  assert.deepEqual(result.high_risk_document_ids, ['10']);
});
