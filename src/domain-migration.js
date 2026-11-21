const ABSOLUTE_URL_RE = /https?:\/\/[^\s"'<>]+/gi;
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
  if (!matchesDomain(value, oldDomain)) return value;
  const url = new URL(value);
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
