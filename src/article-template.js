/*
 * Platform-owned article template.
 *
 * The template is intentionally independent from provider output.
 * CSS/JS can evolve here without asking the text provider to regenerate content.
 */

export const ARTICLE_TEMPLATE_VERSION = 1;

export const ARTICLE_TEMPLATE = Object.freeze({
  version: ARTICLE_TEMPLATE_VERSION,
  slots: Object.freeze([
    'header',
    'intro',
    'body',
    'interactions',
    'related_carousel',
    'faq',
    'conclusion'
  ]),
  components: Object.freeze({
    header: 'article-header',
    intro: 'article-intro',
    body: 'article-body',
    interactions: 'article-interactions',
    related_carousel: 'article-related-carousel',
    faq: 'article-faq',
    conclusion: 'article-conclusion'
  })
});

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
}

export function createArticleViewModel({
  article = {},
  bodyHtml = '',
  interactions = [],
  carousel = [],
  faqHtml = ''
} = {}) {
  return {
    template_version: ARTICLE_TEMPLATE_VERSION,
    slots: {
      header: {
        title: escapeHtml(article.title),
        meta_description: escapeHtml(article.meta_description)
      },
      intro: article.introHtml || '',
      body: bodyHtml,
      interactions,
      related_carousel: carousel,
      faq: faqHtml,
      conclusion: article.conclusionHtml || ''
    }
  };
}

export function renderArticleTemplate(model) {
  const slots = model?.slots || {};

  return [
    '<article data-template="article" data-template-version="' + ARTICLE_TEMPLATE_VERSION + '">',
    '<header class="article-header">' + (slots.header?.title ? '<h1>' + slots.header.title + '</h1>' : '') + '</header>',
    '<div class="article-intro" data-slot="intro">' + (slots.intro || '') + '</div>',
    '<div class="article-body" data-slot="body">' + (slots.body || '') + '</div>',
    '<section class="article-interactions" data-slot="interactions">' + (slots.interactions || []).map(item => '<div data-interaction="' + escapeHtml(item.type) + '"></div>').join('') + '</section>',
    '<section class="article-related-carousel" data-slot="related_carousel">' + (slots.related_carousel || []).map(item => '<a href="' + escapeHtml(item.url) + '">' + escapeHtml(item.title) + '</a>').join('') + '</section>',
    '<section class="article-faq" data-slot="faq">' + (slots.faq || '') + '</section>',
    '<div class="article-conclusion" data-slot="conclusion">' + (slots.conclusion || '') + '</div>',
    '</article>'
  ].join('');
}
