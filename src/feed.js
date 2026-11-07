import crypto from 'node:crypto';
import { config } from './config.js';
import { parseAtom } from './parser.js';
import { indexKeywordsFor } from './analysis.js';

const hash = (s) => crypto.createHash('sha256').update(s).digest('hex');

async function fetchPage(url) {
  let lastErr;
  for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), config.fetchTimeoutMs);
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': config.userAgent, Accept: 'application/atom+xml' },
        signal: ctrl.signal,
        redirect: 'follow',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} em ${url}`);
      return parseAtom(await res.text());
    } catch (err) {
      lastErr = err;
      if (attempt < config.maxRetries)
        await new Promise((r) => setTimeout(r, 1000 * attempt));
    } finally {
      clearTimeout(t);
    }
  }
  throw lastErr;
}

const pageUrl = (startIndex, orderby) => {
  const u = new URL(config.blogUrl + config.feedPath);
  u.searchParams.set('max-results', String(config.pageSize));
  u.searchParams.set('start-index', String(startIndex));
  // CORREÇÃO (bug #3): incremental ordena por 'updated'. Artigo antigo editado sobe para a
  // página 1 e é detectado no próximo sync. Sem isso, a edição ficaria enterrada na página
  // 2+ e o atalho "para na 1ª página íntegra" nunca a alcançaria até o full sync diário.
  if (orderby) u.searchParams.set('orderby', orderby);
  return u.toString();
};

/**
 * Sincroniza o índice com o feed público.
 * - full=false (incremental): para na primeira página 100% íntegra no índice.
 * - full=true: percorre todas as páginas e remove posts excluídos do blog.
 * Atualiza SOMENTE o que mudou (comparação por hash de conteúdo + título + labels).
 */
export async function syncIndex(store, { full = false } = {}) {
  const now = new Date().toISOString();
  let startIndex = 1;
  let total = null;
  let fetched = 0, inserted = 0, updated = 0, unchanged = 0;
  const seenIds = [];

  for (;;) {
    const { feedMeta, entries } = await fetchPage(pageUrl(startIndex, full ? undefined : 'updated'));
    if (total === null) total = feedMeta.totalResults;
    if (!entries.length) break;
    fetched += entries.length;

    let pageAllUnchanged = true;
    for (const e of entries) {
      seenIds.push(e.id);
      // CORREÇÃO (bug #4): labels entram no hash — mudança só de labels agora é detectada.
      const contentHash = hash(e.contentHtml + ' ' + e.title + ' ' + JSON.stringify(e.labels));
      const existing = store.findRaw(e.id);
      if (existing && existing.content_hash === contentHash && !full) {
        unchanged++;
        continue;
      }
      store.upsert.run({
        id: e.id,
        numericId: e.numericId,
        title: e.title,
        url: e.url,
        published: e.published,
        updated: e.updated,
        labels: JSON.stringify(e.labels),
        contentHash,
        contentHtml: e.contentHtml,
        textClean: e.textClean,
        headings: JSON.stringify(e.headings),
        excerpt: e.excerpt,
        wordCount: e.wordCount,
        keywords: '[]',
        lastChecked: now,
      });
      existing ? updated++ : inserted++;
      pageAllUnchanged = false;
    }

    if (!full && pageAllUnchanged) break;  // atalho incremental
    if (total !== null && fetched >= total) break;
    startIndex += entries.length;
  }

  if (full) store.deleteNotIn(seenIds);
  store.metaSet('last_sync', now);
  if (total !== null) store.metaSet('total_results', String(total));
  // CORREÇÃO (bug #8): keywords são reindexadas aqui dentro — antes, posts novos só
  // ganhavam keywords quando o servidor reiniciava, deixando a análise mais fraca.
  indexKeywordsFor(store, store.allArticles());
  return { total, fetched, inserted, updated, unchanged, full };
}

/** Garante índice fresco conforme TTL; full sync periódico. De-duplica chamadas. */
export function makeSyncGuard(store) {
  let inFlight = null;
  return async function ensureFresh() {
    const last = store.metaGet('last_sync');
    const lastFull = store.metaGet('last_full_sync');
    const now = Date.now();
    const needFull = !lastFull || now - Date.parse(lastFull) > config.fullSyncIntervalMs;
    const needSync = !last || now - Date.parse(last) > config.refreshTtlMs;
    if (!needSync && !needFull) return { synced: false };
    if (inFlight) return inFlight;
    inFlight = (async () => {
      const result = await syncIndex(store, { full: needFull });
      if (needFull) store.metaSet('last_full_sync', new Date(now).toISOString());
      return { synced: true, ...result };
    })().finally(() => { inFlight = null; });
    return inFlight;
  };
}