import { selectEditorialContext } from './editorial-context.js';
import { analyzePosts } from './analysis.js';

function buildEditorialBrief({ corpus, query, sourceTitle = '', limit = 8 }) {
  const searchText = [query, sourceTitle].filter(Boolean).join(' ');
  const context = selectEditorialContext(corpus, searchText, limit);

  const relevantIds = new Set(context.map(item => String(item.id)));
  const findings = analyzePosts(corpus)
    .filter(finding =>
      (finding.posts || []).some(post => relevantIds.has(String(post.id)))
    )
    .slice(0, 20)
    .map(finding => ({
      score: finding.score,
      risk: finding.risk,
      issue_type: finding.issue_type,
      recommendation: finding.recommendation,
      same_intent: finding.same_intent,
      topics: finding.shared_topics || [],
      posts: finding.posts
    }));

  const highRiskDocuments = [...new Set(
    findings
      .filter(finding => finding.risk === 'HIGH')
      .flatMap(finding => (finding.posts || []).map(post => String(post.id)))
  )];

  const occupiedTopics = [
    ...new Set(
      findings
        .flatMap(finding => finding.topics || [])
        .filter(Boolean)
    )
  ];

  return {
    query,
    source_title: sourceTitle,
    relevant_documents: context,
    cannibalization_findings: findings,
    occupied_topics: occupiedTopics,
    high_risk_document_ids: highRiskDocuments
  };
}

export { buildEditorialBrief };
