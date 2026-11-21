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
  html_allowed: true,
  css_allowed: false,
  javascript_allowed: false,
  architecture_commands_allowed: false,
  required_top_level_sections: [
    'article',
    'interactions'
  ],
  transport: 'manual_html',
  html_format: 'raw_html'
});

export const CLAUDE_HTML_OUTPUT_RULES = Object.freeze({
  transport: 'manual_html',
  format: 'raw_html',
  css_allowed: false,
  javascript_allowed: false,
  architecture_commands_allowed: false,
  platform_owns_template: true
});

export function validateClaudeHtmlOutput(value) {
  if (typeof value !== 'string') {
    return { valid: false, errors: ['html_output_must_be_string'] };
  }

  const html = value.trim();
  const errors = [];
  if (!html) errors.push('html_output_empty');
  if (!/<(?:h1|h2|h3|p|ul|ol|blockquote|table|div|section)\\b/i.test(html)) {
    errors.push('html_output_has_no_supported_content_elements');
  }
  if (/<script\\b|javascript:/i.test(html)) errors.push('javascript_forbidden');
  if (/<style\\b|\\sstyle\\s*=|<link\\b/i.test(html)) errors.push('css_markup_forbidden');
  if (/<iframe\\b|<object\\b|<embed\\b/i.test(html)) errors.push('external_embed_forbidden');

  return { valid: errors.length === 0, errors };
}

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



export const CORRECTION_OUTPUT_VERSION = 1;

const FORBIDDEN_PROVIDER_KEYS = Object.freeze([
  'html',
  'css',
  'javascript',
  'script',
  'markup',
  'component',
  'component_markup',
  'architecture',
  'architecture_command',
  'template',
  'stylesheet',
  'style',
  'url'
]);

function containsImplementationMarkup(value) {
  if (typeof value !== 'string') return false;
  return /<\\/?[a-z][^>]*>|<script\\b|javascript:/i.test(value);
}

function findForbiddenProviderFields(value, path = '') {
  const errors = [];
  if (!value || typeof value !== 'object') return errors;

  for (const [key, child] of Object.entries(value)) {
    const normalizedKey = key.toLowerCase();
    const childPath = path ? `${path}.${key}` : key;

    if (FORBIDDEN_PROVIDER_KEYS.includes(normalizedKey)) {
      errors.push(`forbidden_provider_field:${childPath}`);
    }

    if (containsImplementationMarkup(child)) {
      errors.push(`implementation_markup_forbidden:${childPath}`);
    }

    if (child && typeof child === 'object') {
      errors.push(...findForbiddenProviderFields(child, childPath));
    }
  }

  return errors;
}

export function createCorrectionProviderInput(request, {
  relevantContext = [],
  allowedInteractionTypes = INTERACTION_TYPES
} = {}) {
  return {
    version: CORRECTION_OUTPUT_VERSION,
    task: 'editorial_correction',
    objective: request?.objective || '',
    preserve_structure: request?.preserve_structure !== false,
    document: request?.document || {},
    findings: Array.isArray(request?.findings) ? request.findings : [],
    relevant_context: relevantContext,
    allowed_interaction_types: [...allowedInteractionTypes],
    constraints: {
      structured_content_only: true,
      html_allowed: false,
      css_allowed: false,
      javascript_allowed: false,
      component_markup_allowed: false,
      architecture_commands_allowed: false,
      carousel_urls_selected_by: 'platform'
    }
  };
}

export function validateCorrectionProviderOutput(value) {
  const base = validateProviderOutput(value);
  const errors = [...base.errors, ...findForbiddenProviderFields(value)];

  if (value?.related_carousel?.length) {
    errors.push('related_carousel_must_be_platform_owned');
  }

  return {
    valid: errors.length === 0,
    errors: [...new Set(errors)]
  };
}

export const CORRECTION_REQUEST_VERSION = 1;

export function createCorrectionRequest({
  document,
  findings = [],
  relatedCandidates = [],
  preserveStructure = true
} = {}) {
  return {
    version: CORRECTION_REQUEST_VERSION,
    document: {
      id: document?.id ?? null,
      type: document?.document_type || 'article',
      title: String(document?.title || ''),
      url: String(document?.url || '')
    },
    objective: 'corrigir problemas editoriais e SEO sem receber ou alterar a arquitetura HTML/CSS/JS da plataforma',
    preserve_structure: Boolean(preserveStructure),
    findings: findings.map(f => ({
      issue_type: f.issue_type || null,
      risk: f.risk || null,
      score: Number(f.score || 0),
      recommendation: f.recommendation || '',
      related_document: f.relatedArticle
        ? {
            id: f.relatedArticle.id ?? null,
            type: f.relatedArticle.document_type || 'article',
            title: f.relatedArticle.title || '',
            url: f.relatedArticle.url || ''
          }
        : null
    })),
    related_candidates: relatedCandidates.map(item => ({
      id: item.id ?? null,
      title: item.title || '',
      topic: item.primary_topic || '',
      search_intent: item.search_intent || ''
    }))
  };
}
