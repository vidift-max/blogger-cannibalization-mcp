/*
 * Convert manual Claude HTML into a draft workspace.
 * The provider supplies content only; the platform owns metadata,
 * presentation and publication state.
 */
import { normalizeClaudeHtml } from './claude-html-normalizer.js';
import { createContentWorkspace } from './content-workspace.js';

function escapeHtmlText(value) {
  return String(value ?? '').replace(/[&<>\"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '\"': '&quot;',
    "'": '&#39;'
  })[char]);
}

export function importClaudeHtmlToWorkspace(html, options = {}) {
  const normalized = normalizeClaudeHtml(html);
  if (!normalized.ok) return normalized;

  const workspace = createContentWorkspace({
    documentType: options.documentType || 'article',
    documentId: options.documentId ?? null,
    title: normalized.article.title || options.title || '',
    contentHtml: normalized.blocks
      .filter(block => block.type !== 'title')
      .map(block => {
        const tag = block.type === 'heading_2' ? 'h2'
          : block.type === 'heading_3' ? 'h3'
          : block.type === 'quote' ? 'blockquote'
          : block.type === 'paragraph' ? 'p'
          : block.type === 'unordered_list' ? 'ul'
          : block.type === 'ordered_list' ? 'ol'
          : block.type === 'table' ? 'table' : 'div';
        return `<${tag}>${escapeHtmlText(block.content)}</${tag}>`;
      }).join('\n'),
    metadata: options.metadata,
    seoIntelligence: options.seoIntelligence
  });

  workspace.import = {
    source: 'claude_html_manual',
    normalized: true,
    block_count: normalized.blocks.length
  };

  return { ok: true, workspace, normalized };
}
