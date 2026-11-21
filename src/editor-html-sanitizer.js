const ALLOWED_TAGS = new Set([
  'p', 'br', 'h1', 'h2', 'h3', 'blockquote', 'ul', 'ol', 'li',
  'strong', 'b', 'em', 'i', 'u', 's', 'table', 'thead', 'tbody',
  'tr', 'th', 'td', 'a'
]);
const DROP_WITH_CONTENT = new Set([
  'script', 'style', 'iframe', 'object', 'embed', 'svg', 'math',
  'template', 'noscript'
]);

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
}

function defaultParseHtml(html) {
  if (typeof DOMParser === 'undefined') throw new Error('html_parser_unavailable');
  return new DOMParser().parseFromString(String(html ?? ''), 'text/html').body;
}

function safeHref(value) {
  try {
    const parsed = new URL(value);
    return ['https:', 'http:', 'mailto:'].includes(parsed.protocol) ? value : '';
  } catch {
    return '';
  }
}

function renderNode(node) {
  if (node.nodeType === 3) return escapeHtml(node.nodeValue ?? node.textContent ?? '');
  if (node.nodeType !== 1) return '';
  const tag = String(node.tagName || '').toLowerCase();
  if (DROP_WITH_CONTENT.has(tag)) return '';
  const children = Array.from(node.childNodes || []).map(renderNode).join('');
  if (!ALLOWED_TAGS.has(tag)) return children;
  if (tag === 'br') return '<br>';
  if (tag === 'a') {
    const href = safeHref(node.getAttribute?.('href') || '');
    return href ? '<a href="' + escapeHtml(href) + '">' + children + '</a>' : children;
  }
  return '<' + tag + '>' + children + '</' + tag + '>';
}

/**
 * Converts untrusted editor markup to a small semantic allowlist.
 * All attributes are discarded except validated http(s)/mailto links.
 */
export function sanitizeEditorHtml(html, { parseHtml = defaultParseHtml } = {}) {
  const root = parseHtml(String(html ?? ''));
  return Array.from(root.childNodes || []).map(renderNode).join('');
}
