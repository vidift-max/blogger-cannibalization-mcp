/*
 * Related carousel selector.
 *
 * A seleção dos links é responsabilidade da plataforma.
 * O provedor de texto não escolhe URLs de publicação.
 */

function normalize(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function terms(value) {
  return new Set(
    normalize(value)
      .split(/\s+/)
      .filter(word => word.length >= 4)
  );
}

function overlap(a, b) {
  const A = terms(a);
  const B = terms(b);
  if (!A.size || !B.size) return 0;

  let shared = 0;
  for (const word of A) {
    if (B.has(word)) shared++;
  }

  return shared / Math.max(A.size, B.size);
}

export function selectRelatedCarousel({
  article,
  candidates = [],
  limit = 6
} = {}) {
  const safeLimit = Math.max(2, Math.min(6, Number(limit) || 6));
  const sourceId = String(article?.id || '');

  return candidates
    .filter(candidate => candidate && String(candidate.id || '') !== sourceId)
    .filter(candidate => typeof candidate.url === 'string' && candidate.url.trim())
    .map(candidate => {
      const titleScore = overlap(article?.title, candidate.title);
      const topicScore = overlap(article?.primary_topic, candidate.primary_topic);
      const labelScore = overlap(
        Array.isArray(article?.labels) ? article.labels.join(' ') : '',
        Array.isArray(candidate.labels) ? candidate.labels.join(' ') : ''
      );

      const score =
        titleScore * 0.45 +
        topicScore * 0.40 +
        labelScore * 0.15;

      return {
        ...candidate,
        relevance_score: Number(score.toFixed(3))
      };
    })
    .filter(candidate => candidate.relevance_score > 0)
    .sort((a, b) => b.relevance_score - a.relevance_score)
    .slice(0, safeLimit);
}
