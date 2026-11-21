/*
 * Select a small, relevant slice of the synchronized Blogger corpus
 * for editorial/anti-cannibalization decisions.
 */

function tokenize(value) {
  return new Set(
    String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .split(/\s+/)
      .filter(token => token.length >= 4)
  );
}

export function selectEditorialContext(corpus = [], queryText = '', limit = 8) {
  const queryTokens = tokenize(queryText);
  if (!queryTokens.size) return [];

  return corpus
    .map(item => {
      const titleTokens = tokenize(item.title);
      const contentTokens = tokenize(item.content_text);
      const labelsTokens = tokenize(Array.isArray(item.labels) ? item.labels.join(' ') : item.labels);
      const matched = [...queryTokens].filter(token =>
        titleTokens.has(token) || contentTokens.has(token) || labelsTokens.has(token)
      );

      const titleMatches = matched.filter(token => titleTokens.has(token)).length;
      const labelMatches = matched.filter(token => labelsTokens.has(token)).length;
      const score = titleMatches * 4 + labelMatches * 2 + matched.length;

      return {
        id: item.id,
        title: item.title || '',
        url: item.url || '',
        document_type: item.document_type || 'article',
        labels: Array.isArray(item.labels) ? item.labels : [],
        score,
        matched_terms: matched,
        excerpt: String(item.content_text || '').slice(0, 500)
      };
    })
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score || String(a.title).localeCompare(String(b.title)))
    .slice(0, Math.max(1, Math.min(Number(limit) || 8, 20)));
}
