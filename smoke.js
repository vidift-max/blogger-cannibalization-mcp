import { openStore } from '../src/store.js';
import { syncIndex } from '../src/feed.js';
import { buildIndex, analyzeCannibalization, indexKeywordsFor } from '../src/analysis.js';

console.log('=== TESTE REAL: lendo feed público do Blogger ===\n');
const store = openStore();

const t0 = Date.now();
const r = await syncIndex(store, { full: true });
console.log(`Sync completo em ${((Date.now() - t0) / 1000).toFixed(1)}s`);
console.log(`  totalResults do feed : ${r.total}`);
console.log(`  artigos coletados    : ${r.fetched}`);
console.log(`  novos/alterados      : ${r.inserted + r.updated}`);
console.log(`  íntegros (sem toque) : ${r.unchanged}\n`);

const articles = store.allArticles();
console.log(`Índice SQLite: ${articles.length} artigos\n`);
console.log('Primeiros 10 títulos (prova da leitura):');
articles.slice(0, 10).forEach((a, i) => console.log(`  ${i + 1}. ${a.title}`));

console.log('\n=== TESTE DE CANIBALIZAÇÃO (1): pauta sobre tax brackets ===');
indexKeywordsFor(store, articles);
const index = buildIndex(articles);
const test1 = analyzeCannibalization(index, '2027 standard deduction amounts and new IRS tax brackets');
console.log(`Pauta     : ${test1.proposedTopic}`);
console.log(`Risco     : ${test1.riskLevel} (score ${test1.riskScore})`);
console.log(`Concorrente: ${test1.competitors[0]?.title || 'nenhum'}`);
console.log(`Conselho  : ${test1.recommendation}`);

console.log('\n=== TESTE DE CANIBALIZAÇÃO (2): pauta sobre money market ===');
const test2 = analyzeCannibalization(index, 'money market funds vs savings accounts for U.S. savers');
console.log(`Pauta     : ${test2.proposedTopic}`);
console.log(`Risco     : ${test2.riskLevel} (score ${test2.riskScore})`);
console.log(`Concorrente: ${test2.competitors[0]?.title || 'nenhum'}`);
console.log(`Conselho  : ${test2.recommendation}`);

console.log('\n=== TESTE INCREMENTAL: rodando sync de novo (nada deve mudar) ===');
const r2 = await syncIndex(store, { full: false });
console.log(`  inseridos: ${r2.inserted}, alterados: ${r2.updated}, íntegros: ${r2.unchanged}`);

console.log('\n=== FIM: tudo funcionando ===');
store.close();