/*
 * Normalize structured provider content before assembly.
 * This is intentionally conservative: unknown blocks are discarded
 * instead of becoming arbitrary HTML.
 */

import { CONTENT_BLOCK_TYPES, validateProviderOutput } from './content-architecture.js';
import { normalizeInteractions } from './interaction-catalog.js';

export function normalizeProviderArticle(value) {
  const validation = validateProviderOutput(value);

  if (!validation.valid) {
    return { ok: false, errors: validation.errors };
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
