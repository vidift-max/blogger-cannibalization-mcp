/*
 * Normalize structured provider content before assembly.
 * This is intentionally conservative: unknown blocks are discarded
 * instead of becoming arbitrary HTML.
 */

import { CONTENT_BLOCK_TYPES, validateProviderOutput, validateCorrectionProviderOutput } from './content-architecture.js';
import { normalizeInteractions } from './interaction-catalog.js';

export function normalizeProviderArticle(value) {
  const validation = validateProviderOutput(value);

  if (Array.isArray(value?.related_carousel) && value.related_carousel.length > 0) {
    return { ok: false, errors: ['related_carousel_must_be_platform_owned'] };
  }

  const hasValidBlock = Array.isArray(value.blocks) && value.blocks.some(block =>
    block && CONTENT_BLOCK_TYPES.includes(block.type)
  );
  const blockingErrors = validation.errors.filter(error =>
    !error.startsWith('unsupported_block_type:') || !hasValidBlock
  );

  if (blockingErrors.length) {
    return { ok: false, errors: blockingErrors };
  }

  const blocks = value.blocks
    .filter(block => CONTENT_BLOCK_TYPES.includes(block.type))
    .map(block => ({
      type: block.type,
      content: typeof block.content === 'string' ? block.content.trim() : block.content
    }))
    .filter(block => block.content !== '');

  return {
    ok: true,
    article: {
      title: String(value.article?.title || '').trim(),
      meta_description: String(value.article?.meta_description || '').trim(),
      primary_topic: String(value.article?.primary_topic || '').trim(),
      search_intent: String(value.article?.search_intent || '').trim(),
      summary: String(value.article?.summary || '').trim(),
      target_query: String(value.article?.target_query || '').trim()
    },
    blocks,
    interactions: normalizeInteractions(value.interactions),
    related_carousel: []
  };
}


export function normalizeCorrectionProviderOutput(value) {
  const validation = validateCorrectionProviderOutput(value);

  if (!validation.valid) {
    return { ok: false, errors: validation.errors };
  }

  const normalized = normalizeProviderArticle(value);

  if (!normalized.ok) {
    return normalized;
  }

  return {
    ok: true,
    correction: {
      article: normalized.article,
      blocks: normalized.blocks,
      interactions: normalized.interactions,
      related_carousel: []
    }
  };
}
