// ---------- tokenização ----------
const STOP = new Set(('a an the and or but if then else for to of in on at by with from as is are was were be been being it its this that these those there here what which who whom when where why how can could should would will shall may might must do does did have has had you your we our they their he his she her not no nor so such than too very just also more most other some any each few many much own same only over under again further once about into through during before after above below between both all while via per within without i me my us ours them him theirs am isn aren wasn weren don doesn didn hasn haven hadn ll re ve d m o s t').split(' '));

export function tokenize(text) {
  return (String(text || '').toLowerCase().match(/[a-z][a-z0-9'-]+/g) || [])
    // CORREÇÃO: removido .replace(/s$/,'') — quebrava 'rates'->'rate', 'brackets'->'bracket',
    // destruía bigramas ('mortgage rates') e a comparação com labels do Blogger.
    .map((w) => w.replace(/'(s|t|re|ve|ll|d)$/, ''))
    .filter((w) => w.length > 2 && !STOP.has(w));
}

const ngrams = (tokens, n) =>
  tokens.slice(0, -n + 1).map((_, i) => tokens.slice(i, i + n).join(' '));

/** Keywords = unigramas recorrentes + bigramas/trigramas mais frequentes */
export function extractKeywords(text, topN = 12) {
  const tokens = tokenize(text);
  const freq = {};
  for (const g of [...ngrams(tokens, 1), ...ngrams(tokens, 2), ...ngrams(tokens, 3)]) {
    freq[g] = (freq[g] || 0) + (g.includes(' ') ? 2 : 1);
  }
  return Object.entries(freq)
    .filter(([k]) => !((k.includes(' ') === false) && tokens.filter((t) => t === k).length < 2))
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([k]) => k);
}

// ---------- TF-IDF local (sem API, sem chave) ----------
export function buildIndex(articles) {
  const docs = articles.map((a) => ({
    id: a.id, title: a.title, url: a.url, labels: a.labels || [], keywords: a.keywords || [],
    tokens: [
      ...tokenize(a.title), ...tokenize(a.title), ...tokenize(a.title), // título pesa 3x
      ...tokenize((a.headings || []).join(' ')), ...tokenize((a.headings || []).join(' ')),
      ...tokenize((a.textClean || '').slice(0, 8000)),
    ],
  }));
  const df = {};
  for (const d of docs) for (const t of new Set(d.tokens)) df[t] = (df[t] || 0) + 1;
  const N = Math.max(docs.length, 1);
  const idf = {};
  for (const [t, n] of Object.entries(df)) idf[t] = Math.log(1 + N / n);
  const vectors = docs.map((d) => {
    const tf = {};
    for (const t of d.tokens) tf[t] = (tf[t] || 0) + 1;
    const v = {};
    for (const [t, c] of Object.entries(tf)) v[t] = c * (idf[t] || 0);
    return { ...d, vector: v, norm: Math.sqrt(Object.values(v).reduce((s, x) => s + x * x, 0)) || 1 };
  });
  return {
    vectors, idf, N,
    vectorize(text) {
      const tokens = tokenize(text);
      const tf = {};
      for (const t of tokens) tf[t] = (tf[t] || 0) + 1;
      const v = {};
      for (const [t, c] of Object.entries(tf)) v[t] = c * (idf[t] || 0);
      return { vector: v, norm: Math.sqrt(Object.values(v).reduce((s, x) => s + x * x, 0)) || 1 };
    },
  };
}

export function cosine(a, b) {
  let dot = 0;
  const [small, big] = Object.keys(a.vector).length < Object.keys(b.vector).length ? [a, b] : [b, a];
  for (const t of Object.keys(small.vector)) if (big.vector[t]) dot += small.vector[t] * big.vector[t];
  return dot / (a.norm * b.norm);
}

// ---------- intenção de busca (heurística editorial determinística) ----------
const INTENT_PATTERNS = [
  ['transactional', /\b(buy|shop|purchase|order|price|cost|cheap|discount|deal|quote|apply|application|open an account|best rate|rates today|refinance|calculator|near me)\b/i],
  ['commercial', /\b(best|top|review|compare|comparison|vs\.?|versus|rating|which|should i|worth it|pros and cons|how to choose|recommend)\b/i],
  ['navigational', /\b(login|log in|sign in|official|customer service|phone number|app download|stateside money)\b/i],
  ['informational', /\b(what|why|how|when|where|who|explained|meaning|definition|guide|tips|rules|limits|brackets|schedule|news|update|report|data|statistics|average)\b/i],
];

export function classifyIntent(text) {
  for (const [intent, re] of INTENT_PATTERNS) if (re.test(String(text || ''))) return intent;
  return 'informational';
}

export function journeyStage(intent) {
  return { informational: 'awareness/consideration', commercial: 'consideration/evaluation',
           transactional: 'decision/action', navigational: 'brand/access' }[intent] || 'unknown';
}

// ---------- canibalização ----------
// CALIBRAÇÃO: as faixas abaixo (0.12 / 0.28 / 0.55) foram ajustadas em corpus sintético de 53
// documentos. Após rodar `npm run smoke` no blog real, revise-as se os veredictos parecerem
// sistematicamente permissivos ou rígidos — são os únicos "botões" de calibração do sistema.
const round = (n) => Math.round(n * 1000) / 1000;

export function analyzeCannibalization(index, proposedTopic, { limit = 8 } = {}) {
  const q = index.vectorize(proposedTopic);
  const qIntent = classifyIntent(proposedTopic);
  const qTokens = new Set(tokenize(proposedTopic));
  const qKeywords = new Set(extractKeywords(proposedTopic, 10));

  const scored = index.vectors.map((doc) => {
    const contentSim = cosine(q, doc);
    const titleSim = cosine(index.vectorize(proposedTopic), index.vectorize(doc.title));
    const docLabels = new Set((doc.labels || []).map((l) => l.toLowerCase()));
    const labelOverlap = [...qKeywords].filter((k) => docLabels.has(k.toLowerCase())).length / Math.max(qKeywords.size, 1);
    const kwOverlap = [...qKeywords].filter((k) => (doc.keywords || []).includes(k)).length / Math.max(qKeywords.size, 1);
    const docIntent = classifyIntent(doc.title + ' ' + (doc.keywords || []).join(' '));
    const tokenF1 = (2 * [...qTokens].filter((t) => doc.tokens.includes(t)).length) /
                    (qTokens.size + new Set(doc.tokens).size || 1);

    let score = 0.40 * contentSim + 0.25 * titleSim + 0.15 * labelOverlap +
                0.10 * kwOverlap + 0.10 * tokenF1;
    score *= docIntent === qIntent ? 1.25 : 0.80;

    return {
      id: doc.id, title: doc.title, url: doc.url, labels: doc.labels,
      contentSimilarity: round(contentSim), titleSimilarity: round(titleSim),
      labelOverlap: round(labelOverlap), keywordOverlap: round(kwOverlap),
      tokenOverlap: round(tokenF1), sameIntent: docIntent === qIntent,
      articleIntent: docIntent, score: round(score),
    };
  });

  scored.sort((a, b) => b.score - a.score);
  const competitors = scored.slice(0, limit).filter((s) => s.score > 0.08);
  const top = competitors[0];

  // CORREÇÃO (bug #2): evidência específica = pelo menos 1 keyword (unigrama recorrente ou
  // bigrama) OU label compartilhada. Similaridade de cosseno sozinha, por palavras genéricas
  // do nicho (ex.: "fund", "credit cards"), NÃO configura canibalização. Sem evidência,
  // o risco fica no máximo "low" — elimina o falso positivo provado no teste (HIGH 0.476
  // para um tópico sem relação nenhuma com o artigo concorrente).
  const evidenceOf = (c) => c.keywordOverlap > 0 || c.labelOverlap > 0;
  const cappedScore = top && !evidenceOf(top)
    ? Math.min(top.score, 0.119)
    : top?.score;

  let riskLevel, recommendation;
  if (!top || cappedScore < 0.12) {
    riskLevel = 'low';
    recommendation = 'Pode publicar. Nenhum artigo compete de forma relevante por essa pauta. Cubra a intenção principal com profundidade.';
  } else if (cappedScore < 0.28) {
    riskLevel = 'medium';
    recommendation = 'Risco moderado: existe sobreposição temática, mas as keywords principais ainda permitem diferenciação. Mude o ângulo, o público ou a intenção — ou expanda o artigo existente em vez de criar um novo.';
  } else if (cappedScore < 0.55 || (top.keywordOverlap === 0 && top.labelOverlap < 0.34)) {
    riskLevel = 'high';
    recommendation = 'Risco alto: sobreposição forte de tema/intenção com um artigo existente. Atualize/expanda o artigo concorrente ou reescreva a pauta com ângulo claramente diferente.';
  } else {
    riskLevel = 'critical';
    recommendation = 'Canibalização crítica: a pauta já existe no blog essencialmente (mesma keyword principal e mesma intenção). Atualize o artigo existente em vez de criar post novo.';
  }

  const conflictingKeywords = top
    ? extractKeywords(proposedTopic, 10).filter((k) =>
        top.title.toLowerCase().includes(k) ||
        (top.labels || []).some((l) => l.toLowerCase().includes(k)))
    : [];

  return {
    proposedTopic,
    analyzedAt: new Date().toISOString(),
    proposedIntent: qIntent,
    proposedJourneyStage: journeyStage(qIntent),
    riskLevel,
    riskScore: top ? cappedScore : 0,
    competitors,
    conflictingKeywords,
    recommendation,
    suggestedAngles: riskLevel === 'low' ? [] : suggestAngles(proposedTopic, competitors, qIntent),
  };
}

function suggestAngles(topic, competitors, intent) {
  const alternatives = ['informational', 'commercial', 'transactional'].filter((i) => i !== intent);
  const t = topic.replace(/\b(best|guide|how to|what is)\b/gi, '').trim();
  return [
    `Mudar a intenção de "${intent}" para "${alternatives[0]}": ex. "${t} — comparação de opções e custos"`,
    `Recortar por público/estágio: ex. "para iniciantes", "em ${new Date().getFullYear()}", "por estado"`,
    `Reforçar o artigo concorrente "${competitors[0]?.title || ''}" com seção dedicada a "${t}" em vez de post novo`,
  ];
}

/** Recalcula keywords de todos os artigos no banco (roda após sync) */
export function indexKeywordsFor(store, articles) {
  const stmt = store.db.prepare('UPDATE articles SET keywords = ? WHERE id = ?');
  for (const a of articles) {
    stmt.run(JSON.stringify(extractKeywords(`${a.title} ${(a.headings || []).join(' ')} ${(a.textClean || '').slice(0, 4000)}`)), a.id);
  }
}