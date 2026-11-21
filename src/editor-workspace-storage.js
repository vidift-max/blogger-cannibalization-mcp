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
    if (!workspace.document || typeof workspace.document !== 'object') return null;
    if (!Array.isArray(workspace.sections) || !workspace.workflow || typeof workspace.workflow !== 'object') return null;
    return workspace;
  } catch {
    return null;
  }
}

export function saveWorkspace(workspace, storage) {
  if (!storage || typeof storage.setItem !== 'function') throw new Error('storage_required');
  storage.setItem('workspace', serializeWorkspace(workspace));
}

export function loadWorkspace(storage) {
  if (!storage || typeof storage.getItem !== 'function') throw new Error('storage_required');
  return deserializeWorkspace(storage.getItem('workspace'));
}

export function clearWorkspace(storage) {
  if (!storage || typeof storage.removeItem !== 'function') throw new Error('storage_required');
  storage.removeItem('workspace');
}
