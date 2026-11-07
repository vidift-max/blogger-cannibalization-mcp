import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openStore } from '../src/store.js';
import { syncIndex } from '../src/feed.js';
import { buildIndex, analyzeCannibalization, indexKeywordsFor } from '../src/analysis.js';

const LIVE = process.env.RUN_LIVE === '1';
const store = openStore(':memory:');

test('feed real: coleta completa dos 53 artigos', { skip: !LIVE && 'rode com: npm run test:live' }, async () => {
  const r = await syncIndex(store, { full: true });
  assert.ok(r.total >= 50, `totalResults inesperado: ${r.total}`);
  assert.equal(r.fetched, r.total, 'paginação deve coletar todos');
  assert.equal(store.allArticles().length, r.total);
  for (const a of store.allArticles()) {
    assert.ok(a.title && a.url && a.published && a.id && a.updated, `incompleto: ${a.id}`);
    assert.ok(a.labels.length > 0, `sem labels: ${a.title}`);
    assert.ok(a.textClean.length > 50, `sem texto: ${a.title}`);
  }
});

test('feed real: sync incremental não regrava nada', { skip: !LIVE && 'npm run test:live' }, async () => {
  const r = await syncIndex(store, { full: false });
  assert.equal(r.inserted, 0);
  assert.equal(r.updated, 0);
});

test('feed real: análise de canibalização com artigos reais', { skip: !LIVE && 'npm run test:live' }, async () => {
  indexKeywordsFor(store, store.allArticles());
  const r = analyzeCannibalization(buildIndex(store.allArticles()),
    'money market funds vs savings accounts for savers');
  console.log(JSON.stringify(r, null, 2));
  assert.ok(['low', 'medium', 'high', 'critical'].includes(r.riskLevel));
  assert.ok(r.competitors.length > 0, 'blog deve ter candidatos próximos');
});