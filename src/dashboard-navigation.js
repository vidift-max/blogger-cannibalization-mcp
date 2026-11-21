const ITEM = (id, label, route, scope = 'global') => ({ id, label, route, scope });

export const DASHBOARD_NAVIGATION = Object.freeze([
  ITEM('articles', 'Artigos', '/articles'), ITEM('pages', 'Páginas', '/pages'),
  ITEM('stats', 'Estatísticas', '/stats'), ITEM('comments', 'Comentários', '/comments'),
  ITEM('labels', 'Categorias/Labels', '/labels'), ITEM('seo-intelligence', 'SEO Intelligence', '/seo-intelligence'),
  ITEM('domain-migration', 'Migração de domínio', '/domain-migration'), ITEM('theme', 'Tema', '/theme'),
  ITEM('settings', 'Configurações', '/settings')
]);

export const CONTENT_TOOLS = Object.freeze({
  article: Object.freeze(['editor','html','preview','labels','permalink','meta-description','featured-image','author','publish-date','seo','related-articles','seo-intelligence']),
  page: Object.freeze(['editor','html','preview','permalink','meta-description','featured-image','seo'])
});
export const GLOBAL_TOOLS = Object.freeze(['domain-migration','theme','settings','stats','comments','labels']);
export function getDashboardNavigation() { return DASHBOARD_NAVIGATION.map(item => ({ ...item })); }
export function getContentTools(documentType) { return [...CONTENT_TOOLS[documentType === 'page' ? 'page' : 'article']]; }
export function isGlobalTool(toolId) { return GLOBAL_TOOLS.includes(String(toolId || '')); }
export function isContentTool(toolId, documentType = 'article') { return getContentTools(documentType).includes(String(toolId || '')); }
