/* Local editorial workspace storage.
 * Persistence is deliberately limited to the workspace document.
 * Operator sessions/capabilities must never be persisted.
 */

export const EDITOR_WORKSPACE_STORAGE_VERSION = 1;

export function serializeWorkspace(workspace) {
  if (!workspace || typeof workspace !== 'object') throw new Error('workspace_required');
  const snapshot = {
    version: EDITOR_WORKSPACE_STORAGE_VERSION,
    document: workspace.document,
    sections: workspace.sections,
    metadata: workspace.metadata,
    seo_intelligence: workspace.seo_intelligence,
    workflow: workspace.workflow,
    import: workspace.import
  };
  return JSON.stringify(snapshot);
}

export function deserializeWorkspace(raw) {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  try {
    const workspace = JSON.parse(raw);
    if (!workspace || workspace.version !== EDITOR_WORKSPACE_STORAGE_VERSION) return null;

    const document = workspace.document;
    if (!document || typeof document !== 'object' || Array.isArray(document)) return null;
    if (document.id !== null && typeof document.id !== 'string') return null;
    if (!['article', 'page'].includes(document.type)) return null;
    if (typeof document.title !== 'string' || typeof document.content_html !== 'string') return null;

    if (!Array.isArray(workspace.sections) || !workspace.sections.every(section => typeof section === 'string')) return null;
    if (!workspace.workflow || typeof workspace.workflow !== 'object' || Array.isArray(workspace.workflow)) return null;
    if (!['draft', 'review', 'preview', 'approved', 'published'].includes(workspace.workflow.state)) return null;
    if (typeof workspace.workflow.publication_allowed !== 'boolean') return null;
    if (workspace.workflow.publication_allowed !== (workspace.workflow.state === 'approved')) return null;

    if (!workspace.metadata || typeof workspace.metadata !== 'object' || Array.isArray(workspace.metadata)) return null;
    if (!Array.isArray(workspace.metadata.labels) || !['permalink', 'meta_description', 'featured_image', 'author', 'publish_date'].every(key => typeof workspace.metadata[key] === 'string')) return null;
    if (!workspace.seo_intelligence || typeof workspace.seo_intelligence !== 'object' || Array.isArray(workspace.seo_intelligence)) return null;
    if (typeof workspace.seo_intelligence.corpus_status !== 'string' ||
        typeof workspace.seo_intelligence.similarity_signal !== 'boolean' ||
        typeof workspace.seo_intelligence.decision_safe !== 'boolean' ||
        typeof workspace.seo_intelligence.focus !== 'string') return null;

    return workspace;
  } catch {
    return null;
  }
}

export const DEFAULT_WORKSPACE_STORAGE_KEY = 'workspace';

export function saveWorkspace(workspace, storage, key = DEFAULT_WORKSPACE_STORAGE_KEY) {
  if (!storage || typeof storage.setItem !== 'function') throw new Error('storage_required');
  storage.setItem(key, serializeWorkspace(workspace));
}

export function loadWorkspace(storage, key = DEFAULT_WORKSPACE_STORAGE_KEY) {
  if (!storage || typeof storage.getItem !== 'function') throw new Error('storage_required');
  return deserializeWorkspace(storage.getItem(key));
}

export function clearWorkspace(storage, key = DEFAULT_WORKSPACE_STORAGE_KEY) {
  if (!storage || typeof storage.removeItem !== 'function') throw new Error('storage_required');
  storage.removeItem(key);
}
