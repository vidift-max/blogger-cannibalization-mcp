const STOP = new Set(`
the a an and or for to of in on with from by is are was were
how what when where why your you best guide review vs about
into over under after before beginner beginners starting start
basics intro
para com uma um de da do das dos que como por em no na nos
nas seu sua seus suas sobre entre para pelo pela pelos pelas
artigo artigos guia melhor melhores porque
`.split(/\s+/).filter(Boolean));


const INTENT_GROUPS = [
  new Set(['beginner', 'beginners', 'starting', 'start', 'basics', 'intro']),
  new Set(['review', 'reviews', 'test', 'rating', 'opinion']),
  new Set(['price', 'prices', 'cost', 'costs', 'cheap', 'cheapest']),
  new Set(['best', 'top', 'compare', 'comparison', 'versus', 'vs']),
  new Set(['how', 'tutorial', 'steps', 'setup', 'install']),
  new Set(['benefits', 'advantages', 'disadvantages', 'risks', 'pros', 'cons'])
];


/*
 * TÓPICOS PRINCIPAIS
 *
 * O objetivo é diferenciar artigos que pertencem
 * ao mesmo universo financeiro, mas possuem assuntos
 * principais diferentes.
 */
const TOPIC_GROUPS = [
  {
    id: 'credit_card',
    terms: [
      'credit card',
      'credit cards',
      'card debt',
      'credit card debt',
      'card balance',
      'card balances',
      'cardholder',
      'cardholders'
    ]
  },

  {
    id: 'personal_loan',
    terms: [
      'personal loan',
      'personal loans',
      'unsecured personal loan',
      'unsecured personal loans',
      'loan borrowing',
      'loan borrower',
      'loan borrowers'
    ]
  },

  {
    id: 'mortgage',
    terms: [
      'mortgage',
      'mortgages',
      'home loan',
      'home loans',
      'housing loan'
    ]
  },

  {
    id: 'auto_loan',
    terms: [
      'auto loan',
      'auto loans',
      'car loan',
      'car loans',
      'vehicle loan',
      'vehicle loans'
    ]
  },

  {
    id: 'student_loan',
    terms: [
      'student loan',
      'student loans',
      'student debt'
    ]
  },

  {
    id: 'credit_score',
    terms: [
      'credit score',
      'credit scores',
      'fico score',
      'fico scores'
    ]
  },

  {
    id: 'credit_report',
    terms: [
      'credit report',
      'credit reports',
      'credit reporting'
    ]
  },

  {
    id: 'debt',
    terms: [
      'debt',
      'debts',
      'debt consolidation',
      'debt relief',
      'consumer debt',
      'household debt'
    ]
  },

  {
    id: 'banking',
    terms: [
      'bank',
      'banks',
      'banking',
      'checking account',
      'savings account',
      'savings accounts'
    ]
  },

  {
    id: 'interest_rates',
    terms: [
      'interest rate',
      'interest rates',
      'fed rate',
      'federal funds rate',
      'rate decision'
    ]
  }
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


/*
 * Detecta os principais tópicos de um artigo.
 */
function detectTopics(text) {
  const normalized = normalize(text);

  return TOPIC_GROUPS
    .map(group => {
      const matches = group.terms.filter(term =>
        normalized.includes(term)
      );

      return {
        id: group.id,
        matches
      };
    })
    .filter(group => group.matches.length);
}


/*
 * Compara os tópicos dos dois artigos.
 */
function compareTopics(a, b) {
  const topicsA = detectTopics(a);
  const topicsB = detectTopics(b);

  const idsA = new Set(topicsA.map(x => x.id));
  const idsB = new Set(topicsB.map(x => x.id));

  const shared = topicsA
    .filter(x => idsB.has(x.id))
    .map(x => x.id);

  const onlyA = topicsA
    .filter(x => !idsB.has(x.id))
    .map(x => x.id);

  const onlyB = topicsB
    .filter(x => !idsA.has(x.id))
    .map(x => x.id);

  return {
    topicsA: topicsA.map(x => x.id),
    topicsB: topicsB.map(x => x.id),
    shared,
    onlyA,
    onlyB
  };
}


/*
 * Mede se os artigos possuem tópicos principais diferentes.
 */
function topicDifference(topicInfo) {
  if (
    topicInfo.onlyA.length &&
    topicInfo.onlyB.length &&
    !topicInfo.shared.length
  ) {
    return 0.28;
  }

  return 0;
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

  /*
   * A similaridade do corpo possui peso menor.
   *
   * Dois artigos financeiros naturalmente podem
   * compartilhar muitas palavras sem disputar
   * a mesma intenção de busca.
   */
  const bodySimilarity = jaccard(bodyA, bodyB);

  const titleEvidence = Math.max(
    titleSimilarity,
    titleContainment * 0.75
  );

  const phraseEvidence = Math.min(shared.length / 2, 1);

  const difference = intentDifference(titleA, titleB);

  const topicInfo = compareTopics(
    `${a.title || ''} ${a.content_text || a.content_html || ''}`,
    `${b.title || ''} ${b.content_text || b.content_html || ''}`
  );

  const topicDiff = topicDifference(topicInfo);


  /*
   * Peso principal:
   *
   * título        70%
   * corpo         12%
   * frases        18%
   *
   * Depois aplicamos as diferenças de intenção
   * e de tópico.
   */
  let score =
    titleEvidence * 0.70 +
    bodySimilarity * 0.12 +
    phraseEvidence * 0.18 -
    difference -
    topicDiff;


  score = Math.max(0, Math.min(1, score));


  const enoughSharedTerms = sharedTerms.length >= 2;
  const hasSharedPhrase = shared.length >= 1;


  /*
   * Uma palavra genérica em comum não é suficiente.
   */
  if (!enoughSharedTerms && !hasSharedPhrase) {
    score = Math.min(score, 0.25);
  }


  /*
   * Se os tópicos principais são diferentes,
   * impedimos que a similaridade geral do corpo
   * transforme o par automaticamente em HIGH.
   */
  const differentMainTopics =
    topicInfo.onlyA.length &&
    topicInfo.onlyB.length &&
    !topicInfo.shared.length;


  if (differentMainTopics) {
    score = Math.min(score, 0.44);
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


  let recommendation;


  if (classification === 'canibalizacao_provavel') {

    recommendation =
      'Há sinais fortes de possível canibalização. Compare a intenção de busca, as consultas e as páginas no Search Console antes de consolidar, redirecionar ou alterar qualquer artigo.';

  } else if (classification === 'possivel_conflito') {

    recommendation =
      'Há alguma sobreposição temática, mas isso não prova canibalização. Revise a intenção de busca, o tópico principal e os dados do Search Console. Se os tópicos principais forem diferentes, preserve os artigos como conteúdos especializados.';

  } else {

    recommendation =
      'Não há evidências textuais suficientes de que os artigos disputem a mesma intenção de busca.';
  }


  return {

    score: Number(score.toFixed(3)),

    classification,

    risk,

    shared_terms: sharedTerms.slice(0, 15),

    shared_phrases: shared.slice(0, 10),

    title_similarity:
      Number(titleSimilarity.toFixed(3)),

    body_similarity:
      Number(bodySimilarity.toFixed(3)),

    intent_difference:
      difference > 0,

    topic_difference:
      topicDiff > 0,

    topics_a:
      topicInfo.topicsA,

    topics_b:
      topicInfo.topicsB,

    shared_topics:
      topicInfo.shared,

    different_topics:
      [
        ...new Set([
          ...topicInfo.onlyA,
          ...topicInfo.onlyB
        ])
      ],

    recommendation

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

      /*
       * Só apresenta pares que merecem investigação.
       */
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


  return findings.sort(
    (a, b) => b.score - a.score
  );
      }
