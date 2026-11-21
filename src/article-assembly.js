/*
 * Fixed content-to-HTML assembly primitives.
 *
 * Esta camada prova a separação entre conteúdo e apresentação.
 * O template/design final poderá chamar estes renderizadores sem que
 * o provedor de IA tenha acesso ao HTML/CSS/JS da plataforma.
 */

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[char]);
}

export function renderContentBlock(block) {
  if (!block || typeof block !== 'object') return '';

  const content = escapeHtml(block.content);

  switch (block.type) {
    case 'title':
      return `<h1>${content}</h1>`;
    case 'heading_2':
      return `<h2>${content}</h2>`;
    case 'heading_3':
      return `<h3>${content}</h3>`;
    case 'paragraph':
      return `<p>${content}</p>`;
    case 'intro':
      return `<div data-slot="intro"><p>${content}</p></div>`;
    case 'conclusion':
      return `<div data-slot="conclusion"><p>${content}</p></div>`;
    case 'quote':
      return `<blockquote>${content}</blockquote>`;
    default:
      return '';
  }
}

export function renderArticleBlocks(blocks = []) {
  if (!Array.isArray(blocks)) return '';

  return blocks
    .map(renderContentBlock)
    .filter(Boolean)
    .join('\n');
}
