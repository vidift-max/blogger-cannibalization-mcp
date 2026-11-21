import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ARTICLE_SLOTS,
  CAROUSEL_RULES,
  CONTENT_BLOCK_TYPES,
  INTERACTION_TYPES,
  createArticleContract,
  createCorrectionRequest,
  createCorrectionProviderInput,
  validateCorrectionProviderOutput,
  validateClaudeHtmlOutput,
  validateProviderOutput
} from '../src/content-architecture.js';

test('contract exposes platform-owned article slots and components', () => {
  assert.ok(ARTICLE_SLOTS.includes('body'));
  assert.ok(ARTICLE_SLOTS.includes('interactions'));
  assert.ok(ARTICLE_SLOTS.includes('related_carousel'));
  assert.ok(CONTENT_BLOCK_TYPES.includes('heading_2'));
  assert.ok(INTERACTION_TYPES.includes('calculator'));
});

test('contract keeps carousel selection owned by the platform', () => {
  assert.equal(CAROUSEL_RULES.selection_owner, 'platform');
  assert.equal(CAROUSEL_RULES.avoid_direct_competitors, true);
  assert.equal(CAROUSEL_RULES.max_items, 6);
});

test('provider output accepts structured content without implementation code', () => {
  const result = validateProviderOutput({
    article: { title: 'Teste' },
    blocks: [
      { type: 'title', content: 'Teste' },
      { type: 'paragraph', content: 'Texto.' },
      { type: 'heading_2', content: 'Seção' }
    ],
    interactions: [
      { type: 'calculator', title: 'Calculadora', data: {} }
    ],
    related_carousel: []
  });

  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
});

test('provider output rejects HTML and JavaScript in interactions', () => {
  const result = validateProviderOutput({
    article: { title: 'Teste' },
    blocks: [
      { type: 'title', content: 'Teste' }
    ],
    interactions: [
      {
        type: 'calculator',
        html: '<div>não permitido</div>',
        javascript: 'alert(1)'
      }
    ]
  });

  assert.equal(result.valid, false);
  assert.ok(result.errors.includes('interaction_html_forbidden'));
  assert.ok(result.errors.includes('interaction_javascript_forbidden'));
});

test('createArticleContract carries only context needed by the assembly pipeline', () => {
  const contract = createArticleContract({
    article: {
      title: 'Economizar',
      primary_topic: 'economia doméstica',
      search_intent: 'informacional'
    },
    existingContent: [{ id: '1', title: 'Artigo existente' }],
    carouselCandidates: [{ id: '2', title: 'Relacionado', url: 'https://example.com/2' }]
  });

  assert.equal(contract.version, 1);
  assert.equal(contract.article.primary_topic, 'economia doméstica');
  assert.equal(contract.related_carousel.candidates.length, 1);
  assert.equal(contract.output.slots.includes('body'), true);
});


test('cria briefing de correção sem expor arquitetura da plataforma', () => {
  const request = createCorrectionRequest({
    document: { id: 7, document_type: 'article', title: 'Original', url: 'https://example.com/a' },
    findings: [{ issue_type: 'topic_overlap_review', risk: 'MEDIUM', score: 0.5, recommendation: 'revisar intenção' }]
  });
  assert.equal(request.document.id, 7);
  assert.equal(request.preserve_structure, true);
  assert.equal(request.objective.includes('HTML/CSS/JS'), true);
  assert.equal(Object.prototype.hasOwnProperty.call(request, 'html'), false);
});


test('cria entrada Claude somente com contexto editorial relevante', () => {
  const input = createCorrectionProviderInput({
    objective: 'corrigir intenção e conteúdo',
    preserve_structure: true,
    document: { id: 7, title: 'Original' },
    findings: [{ issue_type: 'search_intent_conflict' }]
  }, {
    relevantContext: [{ id: 8, title: 'Relacionado', summary: 'contexto' }]
  });

  assert.equal(input.version, 1);
  assert.equal(input.document.id, 7);
  assert.equal(input.relevant_context.length, 1);
  assert.equal(input.constraints.html_allowed, false);
  assert.equal(input.constraints.javascript_allowed, false);
  assert.equal(input.constraints.carousel_urls_selected_by, 'platform');
  assert.equal(Object.prototype.hasOwnProperty.call(input, 'html'), false);
});

test('aceita saída Claude estruturada e rejeita arquitetura', () => {
  const valid = validateCorrectionProviderOutput({
    article: { title: 'Novo título' },
    blocks: [{ type: 'paragraph', content: 'Texto editorial.' }],
    interactions: []
  });

  assert.equal(valid.valid, true);

  const invalid = validateCorrectionProviderOutput({
    article: { title: 'Novo título' },
    blocks: [{ type: 'paragraph', content: '<div>HTML indevido</div>' }],
    interactions: [{ type: 'calculator', title: 'X', javascript: 'alert(1)' }]
  });

  assert.equal(invalid.valid, false);
  assert.ok(invalid.errors.some(error => error.includes('implementation_markup_forbidden')));
  assert.ok(invalid.errors.includes('interaction_javascript_forbidden'));
});


test('valida a saída manual do Claude como HTML puro sem permitir scripts ou CSS', () => {
  const valid = validateClaudeHtmlOutput('<h1>Título</h1><p>Texto novo.</p><h2>Detalhes</h2>');
  assert.equal(valid.valid, true);

  const invalid = validateClaudeHtmlOutput('<h1>Título</h1><script>alert(1)</script><p>Texto</p>');
  assert.equal(invalid.valid, false);
  assert.ok(invalid.errors.includes('javascript_forbidden'));
});
