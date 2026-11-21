/*
 * Content Architecture Contract
 *
 * Contrato interno entre o texto estruturado recebido do provedor de IA
 * e o montador de artigos da plataforma.
 *
 * O provedor NÃO recebe nem controla HTML/CSS/JavaScript do site.
 * A plataforma é a dona da arquitetura e transforma estes blocos em HTML.
 */

export const CONTENT_CONTRACT_VERSION = 1;

export const CONTENT_BLOCK_TYPES = Object.freeze([
  'title',
  'meta_description',
  'intro',
  'heading_2',
  'heading_3',
  'paragraph',
  'unordered_list',
  'ordered_list',
  'quote',
  'table',
  'faq',
  'conclusion'
]);

export const INTERACTION_TYPES = Object.freeze([
  'calculator',
  'checklist',
  'quiz',
  'comparison',
  'timeline',
  'steps',
  'cta'
]);

export const ARTICLE_SLOTS = Object.freeze([
  'header',
  'intro',
  'body',
  'interactions',
  'related_carousel',
  'faq',
  'conclusion'
]);

export const CAROUSEL_RULES = Object.freeze({
  min_items: 2,
  max_items: 6,
  selection_owner: 'platform',
  selection_basis: [
    'topic',
    'search_intent',
    'semantic_similarity',
    'labels',
    'existing_relationships'
  ],
  avoid_direct_competitors: true,
  require_valid_url: true
});

export const INTERACTION_RULES = Object.freeze({
  recommended_min: 1,
  recommended_max: 4,
  selection_owner: 'platform',
  require_article_relevance: true,
  allow_custom_javascript: false
});

export const PROVIDER_OUTPUT_RULES = Object.freeze({
  html_allowed: false,
  css_allowed: false,
  javascript_allowed: false,
  architecture_commands_allowed: false,
  required_top_level_sections: [
    'article',
    'interactions'
  ]
});

export function createArticleContract({
  article = {},
  existingContent = [],
  availableInteractions = INTERACTION_TYPES,
  carouselCandidates = []
} = {}) {
  return {
    version: CONTENT_CONTRACT_VERSION,
    article: {
      title: String(article.title || ''),
      primary_topic: String(article.primary_topic || ''),
      search_intent: String(article.search_intent || ''),
      meta_description: String(article.meta_description || '')
    },
    output: {
      blocks: CONTENT_BLOCK_TYPES,
      slots: ARTICLE_SLOTS
    },
    interactions: {
      allowed_types: [...availableInteractions],
      rules: INTERACTION_RULES
    },
    related_carousel: {
      candidates: carouselCandidates,
      rules: CAROUSEL_RULES
    },
    existing_content: existingContent
  };
}

export function validateProviderOutput(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { valid: false, errors: ['output_must_be_object'] };
  }

  const errors = [];

  if (!value.article || typeof value.article !== 'object') {
    errors.push('article_required');
  }

  if (!Array.isArray(value.blocks)) {
    errors.push('blocks_required');
  } else {
    for (const block of value.blocks) {
      if (!block || typeof block !== 'object') {
        errors.push('invalid_block');
        continue;
      }

      if (!CONTENT_BLOCK_TYPES.includes(block.type)) {
        errors.push(`unsupported_block_type:${String(block.type || '')}`);
      }

      if (typeof block.content !== 'string' && block.type !== 'table' && block.type !== 'faq') {
        errors.push(`block_content_required:${String(block.type || '')}`);
      }
    }
  }

  if (value.interactions !== undefined && !Array.isArray(value.interactions)) {
    errors.push('interactions_must_be_array');
  }

  if (Array.isArray(value.interactions)) {
    for (const interaction of value.interactions) {
      if (!interaction || !INTERACTION_TYPES.includes(interaction.type)) {
        errors.push(`unsupported_interaction_type:${String(interaction?.type || '')}`);
      }
      if (interaction && interaction.html) {
        errors.push('interaction_html_forbidden');
      }
      if (interaction && interaction.javascript) {
        errors.push('interaction_javascript_forbidden');
      }
    }
  }

  if (value.related_carousel !== undefined && !Array.isArray(value.related_carousel)) {
    errors.push('related_carousel_must_be_array');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
