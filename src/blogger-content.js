const ENTITY_RE = /&(?:nbsp|amp|lt|gt|quot|#39|#\d+);/gi;

export function normalizeBloggerDocument(item = {}) {
  const type = item.type === 'page' ? 'page' : 'article';
  const sourceId = String(
    type === 'page' ? item.blogger_page_id : item.blogger_post_id
  );

  return {
    type,
    source_id: sourceId,
    title: cleanText(item.title),
    url: cleanUrl(item.url),
    content_html: String(item.content_html || ''),
    content_text: htmlToText(item.content_html || ''),
    labels: Array.isArray(item.labels)
      ? item.labels.map(cleanText).filter(Boolean)
      : [],
    updated_at: item.updated_at || null
  };
}

export function htmlToText(html = '') {
  return String(html)
    .replace(/<script[\\s\\S]*?<\\/script>/gi, ' ')
    .replace(/<style[\\s\\S]*?<\\/style>/gi, ' ')
    .replace(/<noscript[\\s\\S]*?<\\/noscript>/gi, ' ')
    .replace(/<br\\s*\\/?>(?=\\S)/gi, '\\n')
    .replace(/<\\/p>|<\\/div>|<\\/li>|<\\/h[1-6]>/gi, '\\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(ENTITY_RE, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/&#\\d+;/g, ' ')
    .replace(/\\s+/g, ' ')
    .trim();
}

function cleanText(value) {
  return String(value || '').replace(/\\s+/g, ' ').trim();
}

function cleanUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    const url = new URL(raw);
    return /^https?:$/.test(url.protocol) ? url.toString() : '';
  } catch {
    return '';
  }
}

export function contentFingerprint(item = {}) {
  const normalized = normalizeBloggerDocument(item);
  return [
    normalized.type,
    normalized.source_id,
    normalized.title,
    normalized.url,
    normalized.content_html,
    normalized.labels.join('|'),
    normalized.updated_at || ''
  ].join('\\n');
}
