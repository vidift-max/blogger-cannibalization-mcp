import { getDashboardNavigation, getContentTools } from './dashboard-navigation.js';

export const DASHBOARD_SHELL = Object.freeze({
  topbar: Object.freeze(['menu','brand','search','status','account']),
  sidebar: Object.freeze(['navigation','new-content']),
  main: Object.freeze(['page-header','workspace','status-bar']),
  contentEditor: Object.freeze(['title','content','toolbar','preview','metadata']),
  responsive: Object.freeze({ desktop: 'sidebar-visible', tablet: 'sidebar-collapsible', mobile: 'sidebar-drawer' })
});

export function createDashboardShell(documentType = null) {
  return {
    topbar: [...DASHBOARD_SHELL.topbar],
    sidebar: { navigation: getDashboardNavigation(), newContent: ['new-article', 'new-page', 'import-content'] },
    main: [...DASHBOARD_SHELL.main],
    editor: documentType ? { documentType: documentType === 'page' ? 'page' : 'article', tools: getContentTools(documentType) } : null,
    responsive: { ...DASHBOARD_SHELL.responsive }
  };
}
