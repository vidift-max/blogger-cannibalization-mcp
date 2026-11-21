/*
 * Normalize manual Claude HTML into platform-owned editorial blocks.
 * Claude may return raw HTML as a transport format, but the platform
 * extracts only supported semantic elements before final assembly.
 */

import { CONTENT_BLOCK_TYPES, validateClaudeHtmlOutput } from './content-architecture.js';

const TAG_TO_BLOCK = Object.freeze({
  h1: 'title',
  h2: 'heading_2',
  h3: 'heading_3',
  p: 'paragraph',
  blockquote: 'quote',
  ul: 'unordered_list',
  ol: 'ordered_list',
  table: 'table'
});

function decodeBasicEntities(value) {
  return String(value)
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function stripTags(value) {
  return decodeBasicEntities(String(value).replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

export function normalizeClaudeHtml(value) {
  const validation = validateClaudeHtmlOutput(value);
  if (!validation.valid) return { ok: false, errors: validation.errors };

  const html = value.trim();
  const blocks = [];
  const tagPattern = /<(h1|h2|h3|p|blockquote|ul|ol|table)\b[^>]*>([\s\S]*?)<\/\1>/gi;

  for (const match of html.matchAll(tagPattern)) {
    const type = TAG_TO_BLOCK[match[1].toLowerCase()];
    if (!CONTENT_BLOCK_TYPES.includes(type)) continue;
    const content = stripTags(match[2]);
    if (!content) continue;
    blocks.push({ type, content });
  }

  if (!blocks.length) {
    return { ok: false, errors: ['html_output_contains_no_extractable_blocks'] };
  }

  return {
    ok: true,
    article: {
      title: blocks.find(block => block.type === 'title')?.content || '',
      meta_description: '',
      primary_topic: '',
      search_intent: ''
    },
    blocks,
    interactions: [],
    related_carousel: []
  };
}
