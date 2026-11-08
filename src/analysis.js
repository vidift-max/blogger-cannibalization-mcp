
const STOP = new Set(`
the a an and or for to of in on with from by is are was were
how what when where why your you best guide review vs about
into over under after before beginner beginners beginners
para com uma um de da do das dos que como por em no na nos
nas seu sua seus suas sobre entre para pelo pela pelos pelas
artigo artigos guia melhor melhores como porque
`.split(/\s+/).filter(Boolean));

const INTENT_GROUPS = [
  new Set(['beginner', 'beginners', 'starting', 'start', 'basics', 'intro']),
  new Set(['review', 'reviews', 'test', 'rating', 'opinion']),
  new Set(['price', 'prices', 'cost', 'costs', 'cheap', 'cheapest']),
  new Set(['best', 'top', 'compare', 'comparison', 'versus', 'vs']),
  new Set(['how', 'tutorial', 'steps', 'setup', 'install']),
  new Set(['benefits', 'advantages', 'disadvantages', 'risks', 'pros', 'cons'])
];

function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, ' and ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function words(text) {
  return normalize(text)
    .split(/\s+/)
    .filter(w => w.length >= 3 && !STOP.has(w));
}

function uniqueWords(text) {
  return [...new Set(words(text))];
}

function jaccard(a, b) {
  const A = new Set(a);
  const B = new Set(b);

  if (!A.size || !B.size) return 0;

  let intersection = 0;

  for (const word of A) {
    if (B.has(word)) intersection++;
  }

  return intersection / (A.size + B.size - intersection);
}

function containment(a, b) {
  const A = new Set(a);
  const B = new Set(b);

  if (!A.size || !B.size) return 0;

  let intersection = 0;

  for (const word of A) {
    if (B.has(word)) intersection++;
  }

  return intersection / Math.min(A.size, B.size);
}

function phrases(tokens) {
  const result = new Set();

  for (let i = 0; i < tokens.length - 1; i++) {
    result.add(`${tokens[i]} ${tokens[i + 1]}`);
  }

  return result;
}

function sharedPhrases(a, b) {
  const A = phrases(a);
  const B = phrases(b);

  return [...A].filter(phrase => B.has(phrase));
}

function intentGroups(tokens) {
  return INTENT_GROUPS
    .map((group, index) => ({
      index,
      words: tokens.filter(word => group.has(word))
    }))
    .filter(item => item.words.length);
}

function intentDifference(a, b) {
  const A = intentGroups(a);
  const B = intentGroups(b);

  if (!A.length || !B.length) return 0;

  const shared = A.some(x =>
    B.some(y => x.index === y.index)
  );

  const different = A.some(x =>
    B.some(y => x.index !== y.index)
  );

  return different && !shared ? 0.22 : 0;
}

function articleText(post) {
  return [
    post.title || '',
    post.content_text || post.content_html || ''
  ].join(' ');
}

function comparePosts(a, b) {
  const titleA = uniqueWords(a.title);
  const titleB = uniqueWords(b.title);

  const bodyA = uniqueWords(articleText(a));
  const bodyB = uniqueWords(articleText(b));

  const sharedTerms = titleA.filter(word =>
    titleB.includes(word)
  );

  const shared = sharedPhrases(titleA, titleB);

  const titleSimilarity = jaccard(titleA, titleB);
  const titleContainment = containment(titleA, titleB);
  const bodySimilarity = jaccard(bodyA, bodyB);

  const titleEvidence = Math.max(
    titleSimilarity,
    titleContainment * 0.75
  );

  const phraseEvidence = Math.min(shared.length / 2, 1);

  const difference = intentDifference(titleA, titleB);

  let score =
    titleEvidence * 0.65 +
    bodySimilarity * 0.20 +
    phraseEvidence * 0.15 -
    difference;

  score = Math.max(0, Math.min(1, score));

  const enoughSharedTerms = sharedTerms.length >= 2;
  const hasSharedPhrase = shared.length >= 1;

  // Uma palavra genérica em comum não é suficiente.
  if (!enoughSharedTerms && !hasSharedPhrase) {
    score = Math.min(score, 0.25);
  }

  let classification = null;
  let risk = null;

  if (
    score >= 0.72 &&
    (enoughSharedTerms || shared.length >= 2)
  ) {
    classification = 'canibalizacao_provavel';
    risk = 'HIGH';
  } else if (
    score >= 0.48 &&
    (enoughSharedTerms || hasSharedPhrase)
  ) {
    classification = 'possivel_conflito';
    risk = 'MEDIUM';
  }

  return {
    score: Number(score.toFixed(3)),
    classification,
    risk,
    shared_terms: sharedTerms.slice(0, 15),
    shared_phrases: shared.slice(0, 10),
    title_similarity: Number(titleSimilarity.toFixed(3)),
    body_similarity: Number(bodySimilarity.toFixed(3)),
    intent_difference: difference > 0,
    recommendation:
      classification === 'canibalizacao_provavel'
        ? 'Investigue se os artigos disputam a mesma consulta no Google. Compare consultas, páginas e posições no Search Console antes de consolidar ou alterar qualquer artigo.'
        : classification === 'possivel_conflito'
          ? 'Revise a intenção de busca, as palavras-chave principais e os resultados do Search Console. A semelhança textual ainda não comprova canibalização.'
          : 'Não há evidências textuais suficientes para recomendar uma alteração.'
  };
}

export function analyzePosts(posts) {
  const findings = [];

  if (!Array.isArray(posts) || posts.length < 2) {
    return findings;
  }

  for (let i = 0; i < posts.length; i++) {
    for (let j = i + 1; j < posts.length; j++) {
      const a = posts[i];
      const b = posts[j];

      const result = comparePosts(a, b);

      // Só apresenta pares que merecem investigação.
      if (!result.classification) continue;

      findings.push({
        ...result,
        posts: [
          {
            id: a.id,
            title: a.title,
            url: a.url
          },
          {
            id: b.id,
            title: b.title,
            url: b.url
          }
        ]
      });
    }
  }

  return findings.sort((a, b) => b.score - a.score);
}
