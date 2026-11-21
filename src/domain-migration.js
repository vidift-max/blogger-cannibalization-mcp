const ABSOLUTE_URL_RE = /(?:https?:)?\/\/[^\s"'<>]+/gi;
const URL_ATTRIBUTE_RE = /\b(?:href|src|action|cite|poster|formaction|data-src|data-href|content)\s*=\s*(["'])(.*?)\1/gi;

function normalizeDomain(value) {
  const raw = String(value || '').trim();
  if (!raw) throw new Error('Domínio obrigatório.');
  const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  const url = new URL(candidate);
  if (!/^https?:$/.test(url.protocol)) throw new Error('Domínio inválido.');
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('Informe somente o domínio, sem caminho, credenciais, query ou fragmento.');
  }
  return url.hostname.toLowerCase().replace(/^www\./, '');
}

function matchesDomain(urlValue, oldDomain) {
  try {
    const url = new URL(urlValue);
    return url.hostname.toLowerCase().replace(/^www\./, '') === oldDomain;
  } catch { return false; }
}

function replaceAbsoluteUrl(value, oldDomain, newDomain) {
  const candidate = /^\/\//.test(value) ? `https:${value}` : value;
  if (!matchesDomain(candidate, oldDomain)) return value;
  const url = new URL(candidate);
  const replacement = new URL(newDomain);
  url.protocol = replacement.protocol;
  url.hostname = replacement.hostname;
  url.port = replacement.port;
  return url.toString();
}

export function replaceDomainInHtml(html, oldDomainInput, newDomainInput) {
  const oldDomain = normalizeDomain(oldDomainInput);
  const newOrigin = `https://${normalizeDomain(newDomainInput)}`;
  let replacements = 0;
  const result = String(html || '').replace(URL_ATTRIBUTE_RE, (full, quote, value) => {
    const replaced = replaceAbsoluteUrl(value, oldDomain, newOrigin);
    if (replaced === value) return full;
    replacements++;
    return full.replace(value, replaced);
  });
  return { html: result, replacements };
}

export function replaceDomainInText(text, oldDomainInput, newDomainInput) {
  const oldDomain = normalizeDomain(oldDomainInput);
  const newOrigin = `https://${normalizeDomain(newDomainInput)}`;
  let replacements = 0;
  const result = String(text || '').replace(ABSOLUTE_URL_RE, value => {
    const replaced = replaceAbsoluteUrl(value, oldDomain, newOrigin);
    if (replaced === value) return value;
    replacements++;
    return replaced;
  });
  return { text: result, replacements };
}

export function summarizeDomainMigration(documentPlans, themePlan = null) {
  const documents = Array.isArray(documentPlans) ? documentPlans : [];
  const summary = { articles: 0, pages: 0, documents_changed: 0, document_replacements: 0, theme_changed: Boolean(themePlan?.changed), theme_replacements: Number(themePlan?.replacements || 0), total_replacements: Number(themePlan?.replacements || 0) };
  for (const document of documents) {
    if (document.type === 'article') summary.articles++;
    if (document.type === 'page') summary.pages++;
    if (document.changed) summary.documents_changed++;
    summary.document_replacements += Number(document.replacements || 0);
  }
  summary.total_replacements += summary.document_replacements;
  return summary;
}

export function planThemeMigration(themeHtml, oldDomain, newDomain) {
  const source = String(themeHtml || '');
  const result = replaceDomainInText(source, oldDomain, newDomain);
  return {
    original_theme_html: source,
    theme_html: result.text,
    replacements: result.replacements,
    changed: result.text !== source
  };
}

export function planDomainMigration(documents, oldDomain, newDomain) {
  return documents.map(document => {
    const source = String(document.content_html || '');
    const result = replaceDomainInHtml(source, oldDomain, newDomain);
    return { ...document, original_content_html: source, content_html: result.html,
      replacements: result.replacements, changed: result.html !== source };
  });
}


export function createDomainMigrationPlan(documents, themeHtml, oldDomain, newDomain) {
  const oldNormalized = normalizeDomain(oldDomain);
  const newNormalized = normalizeDomain(newDomain);
  if (oldNormalized === newNormalized) {
    throw new Error('O domínio antigo e o novo devem ser diferentes.');
  }
  const documentPlans = planDomainMigration(documents, oldNormalized, newNormalized);
  const themePlan = planThemeMigration(themeHtml, oldNormalized, newNormalized);
  return {
    old_domain: oldNormalized,
    new_domain: newNormalized,
    approved: false,
    documents: documentPlans,
    theme: themePlan,
    summary: summarizeDomainMigration(documentPlans, themePlan)
  };
}
