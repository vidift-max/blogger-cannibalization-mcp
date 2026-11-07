import { XMLParser } from 'fast-xml-parser';
import { parse as parseHtml } from 'node-html-parser';

const xml = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  isArray: (name) => ['entry', 'category', 'link', 'author'].includes(name),
});

const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'SVG', 'IFRAME', 'FORM']);

/** HTML do post -> texto limpo + headings. Conteúdo é DADO: nunca executado. */
export function htmlToText(html) {
  const root = parseHtml(html || '');
  root.querySelectorAll('*').forEach((el) => {
    if (SKIP_TAGS.has(el.tagName)) el.remove();
  });
  root.childNodes.forEach((n) => { if (n.nodeType === 8) n.remove(); });
  const headings = root.querySelectorAll('h1,h2,h3')
    .map((h) => h.text.trim()).filter(Boolean).slice(0, 30);
  const text = root.text
    .replace(/ /g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim();
  const words = text.split(/\s+/).filter(Boolean);
  return { text, headings, wordCount: words.length, excerpt: words.slice(0, 60).join(' ') };
}

const firstText = (node) => {
  if (!node) return '';
  if (typeof node === 'string') return node;
  return node['#text'] || '';
};

/** XML Atom (string) -> { feedMeta, entries[] } — formato oficial do Blogger */
export function parseAtom(xmlText) {
  const doc = xml.parse(xmlText);
  const feed = doc.feed;
  if (!feed) throw new Error('Feed Atom inválido: <feed> ausente');

  const os = feed['openSearch:totalResults'];
  const feedMeta = {
    blogId: firstText(feed.id),
    blogTitle: firstText(feed.title),
    totalResults: os ? parseInt(firstText(os), 10) : null,
    feedUpdated: firstText(feed.updated),
  };

  const entries = (feed.entry || []).map((e) => {
    const links = e.link || [];
    const alt = links.find((l) => l['@_rel'] === 'alternate' && l['@_type'] === 'text/html');
    const edit = links.find((l) => l['@_rel'] === 'edit');
    const numericId = edit ? edit['@_href'].split('/').pop() : null;
    const rawHtml = firstText(e.content) || firstText(e.summary) || '';
    const { text, headings, wordCount, excerpt } = htmlToText(rawHtml);
    return {
      id: firstText(e.id),                 // tag:blogger.com,1999:blog-XXX.post-YYY
      numericId,
      title: (firstText(e.title) || '').trim(),
      url: alt ? alt['@_href'] : '',
      published: firstText(e.published),
      updated: firstText(e.updated),
      labels: (e.category || []).map((c) => c['@_term']).filter(Boolean),
      summary: firstText(e.summary),
      contentHtml: rawHtml,
      textClean: text,
      headings,
      wordCount,
      excerpt,
    };
  });

  return { feedMeta, entries };
}