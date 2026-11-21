import { buildEditorialBrief } from './editorial-brief.js';

function normalizeString(value) {
  return String(value ?? '').trim();
}

export function prepareEditorialPipeline({
  corpus = [],
  query = '',
  sourceTitle = '',
  limit = 8
} = {}) {
  const normalizedQuery = normalizeString(query);
  const normalizedSourceTitle = normalizeString(sourceTitle);

  if (!normalizedQuery && !normalizedSourceTitle) {
    throw new Error('editorial_query_required');
  }

  const brief = buildEditorialBrief({
    corpus,
    query: normalizedQuery,
    sourceTitle: normalizedSourceTitle,
    limit
  });

  return {
    version: 1,
    source: {
      query: normalizedQuery,
      title: normalizedSourceTitle
    },
    brief,
    provider_input: {
      task: 'write_article',
      query: normalizedQuery,
      source_title: normalizedSourceTitle,
      relevant_documents: brief.relevant_documents,
      cannibalization_findings: brief.cannibalization_findings,
      occupied_topics: brief.occupied_topics,
      high_risk_document_ids: brief.high_risk_document_ids
    },
    provider_policy: {
      content_only: true,
      platform_owns_html_architecture: true,
      platform_owns_css: true,
      platform_owns_javascript: true,
      publication_requires_user_approval: true
    }
  };
}
