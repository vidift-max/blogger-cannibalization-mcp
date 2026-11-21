/*
 * Contextual content workspace contract.
 *
 * Keeps editing, SEO intelligence, preview and approval states separate.
 * Remote operation may prepare a draft, but publication remains explicit.
 */

export const CONTENT_WORKSPACE_STATES = Object.freeze([
  'draft',
  'review',
  'preview',
  'approved',
  'published'
]);

export const CONTENT_WORKSPACE_SECTIONS = Object.freeze({
  article: Object.freeze([
    'content',
    'metadata',
    'seo_intelligence',
    'preview',
    'approval'
  ]),
  page: Object.freeze([
    'content',
    'metadata',
    'seo_intelligence',
    'preview',
    'approval'
  ])
});

export function createContentWorkspace({
  documentType = 'article',
  documentId = null,
  title = '',
  contentHtml = '',
  metadata = {},
  seoIntelligence = {}
} = {}) {
  const type = documentType === 'page' ? 'page' : 'article';

  return {
    version: 1,
    document: {
      id: documentId,
      type,
      title: String(title),
      content_html: String(contentHtml)
    },
    sections: [...CONTENT_WORKSPACE_SECTIONS[type]],
    metadata: {
      labels: Array.isArray(metadata.labels) ? [...metadata.labels] : [],
      permalink: String(metadata.permalink || ''),
      meta_description: String(metadata.meta_description || ''),
      featured_image: String(metadata.featured_image || ''),
      author: String(metadata.author || ''),
      publish_date: String(metadata.publish_date || '')
    },
    seo_intelligence: {
      corpus_status: String(seoIntelligence.corpus_status || 'not_checked'),
      similarity_signal: Boolean(seoIntelligence.similarity_signal),
      decision_safe: Boolean(seoIntelligence.decision_safe),
      focus: String(seoIntelligence.focus || '')
    },
    workflow: {
      state: 'draft',
      publication_allowed: false
    }
  };
}

export function canPublishWorkspace(workspace) {
  return Boolean(
    workspace &&
    workspace.workflow &&
    workspace.workflow.state === 'approved' &&
    workspace.workflow.publication_allowed === true
  );
}

export function transitionWorkspace(workspace, nextState) {
  if (!workspace || !workspace.workflow) {
    throw new Error('workspace_required');
  }

  if (!CONTENT_WORKSPACE_STATES.includes(nextState)) {
    throw new Error('invalid_workspace_state');
  }

  const current = workspace.workflow.state;

  const allowed = {
    draft: ['review'],
    review: ['preview', 'draft'],
    preview: ['approved', 'review'],
    approved: ['published', 'preview'],
    published: []
  };

  if (!allowed[current].includes(nextState)) {
    throw new Error(`invalid_workspace_transition:${current}->${nextState}`);
  }

  workspace.workflow.state = nextState;
  workspace.workflow.publication_allowed = nextState === 'approved';
  return workspace;
}

export function updateWorkspaceDocument(workspace, { title, contentHtml } = {}) {
  if (!workspace || !workspace.document) throw new Error('workspace_required');
  if (title !== undefined) workspace.document.title = String(title);
  if (contentHtml !== undefined) workspace.document.content_html = String(contentHtml);
  if (workspace.workflow?.state !== 'draft') {
    workspace.workflow.state = 'draft';
    workspace.workflow.publication_allowed = false;
  }
  return workspace;
}
