import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareEditorialPipeline } from '../src/editorial-pipeline.js';

test('prepares a compact provider package from relevant corpus context', () => {
  const result = prepareEditorialPipeline({
    query: 'cartão de crédito',
    sourceTitle: 'Novas regras para cartão de crédito',
    corpus: [
      {
        id: '1',
        title: 'Cartão de crédito: o que mudou',
        content_text: 'Mudanças recentes nas regras do cartão de crédito.',
        labels: ['cartão']
      },
      {
        id: '2',
        title: 'Seguro de carro',
        content_text: 'Guia sobre seguro automotivo.',
        labels: ['carros']
      }
    ],
    limit: 2
  });

  assert.equal(result.version, 1);
  assert.equal(result.provider_input.task, 'write_article');
  assert.equal(result.provider_input.relevant_documents.length, 1);
  assert.equal(result.provider_input.relevant_documents[0].id, '1');
  assert.equal(result.provider_input.output_contract.format, 'structured_json');
  assert.ok(result.provider_input.output_contract.required_fields.includes('blocks'));
  assert.ok(result.provider_input.output_contract.allowed_block_types.includes('paragraph'));
  assert.ok(result.provider_input.output_contract.allowed_interaction_types.includes('calculator'));
  assert.equal(result.provider_input.output_contract.related_carousel, 'platform_selected');
  assert.equal(result.provider_policy.structured_content_only, true);
  assert.equal(result.provider_policy.html_allowed, false);
  assert.equal(result.provider_policy.css_allowed, false);
  assert.equal(result.provider_policy.javascript_allowed, false);
  assert.equal(result.provider_policy.platform_owns_css, true);
  assert.equal(result.provider_policy.publication_requires_user_approval, true);
});

test('rejects an editorial request without a topic or source title', () => {
  assert.throws(
    () => prepareEditorialPipeline({ corpus: [] }),
    /editorial_query_required/
  );
});
