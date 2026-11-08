function decodeEntities(value) {
  return String(value || '')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'");
}

function normalizeText(html) {
  return decodeEntities(
    String(html || '')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
  )
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function extractBlocks(html) {
  const source = String(html || '');
  const blocks = [];
  const regex = /<(p|h[1-6]|li|blockquote|pre|figcaption|tr)\b[^>]*>([\s\S]*?)<\/\1\s*>/gi;

  let match;

  while ((match = regex.exec(source)) !== null) {
    const text = normalizeText(match[2]);

    if (text) {
      blocks.push(text);
    }
  }

  if (blocks.length) {
    return blocks;
  }

  const fallback = normalizeText(source);

  return fallback ? [fallback] : [];
}

function countWithLcs(original, proposed) {
  const n = original.length;
  const m = proposed.length;

  if (!n && !m) return 0;
  if (!n || !m) return 1;

  // Limita o uso de memória em artigos muito grandes.
  if (n * m > 1000000) {
    let start = 0;

    while (
      start < n &&
      start < m &&
      original[start] === proposed[start]
    ) {
      start++;
    }

    let oldEnd = n - 1;
    let newEnd = m - 1;

    while (
      oldEnd >= start &&
      newEnd >= start &&
      original[oldEnd] === proposed[newEnd]
    ) {
      oldEnd--;
      newEnd--;
    }

    return oldEnd < start && newEnd < start ? 0 : 1;
  }

  const width = m + 1;
  const dp = new Uint32Array((n + 1) * width);

  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      const index = i * width + j;

      if (original[i] === proposed[j]) {
        dp[index] = dp[(i + 1) * width + j + 1] + 1;
      } else {
        dp[index] = Math.max(
          dp[(i + 1) * width + j],
          dp[i * width + j + 1]
        );
      }
    }
  }

  let i = 0;
  let j = 0;
  let changes = 0;
  let insideChange = false;

  while (i < n || j < m) {
    if (
      i < n &&
      j < m &&
      original[i] === proposed[j]
    ) {
      insideChange = false;
      i++;
      j++;
      continue;
    }

    if (!insideChange) {
      changes++;
      insideChange = true;
    }

    if (i >= n) {
      j++;
      continue;
    }

    if (j >= m) {
      i++;
      continue;
    }

    const removeScore = dp[(i + 1) * width + j];
    const addScore = dp[i * width + j + 1];

    if (removeScore >= addScore) {
      i++;
    } else {
      j++;
    }
  }

  return changes;
}

/**
 * Conta grupos de trechos diferentes entre o HTML original
 * e o HTML corrigido.
 *
 * Exemplo:
 * 0 = nenhum trecho alterado
 * 1 = um grupo de alterações
 * 3 = três grupos separados de alterações
 */
export function countChangedSections(previousHtml, proposedHtml) {
  const original = extractBlocks(previousHtml);
  const proposed = extractBlocks(proposedHtml);

  if (
    original.length === proposed.length &&
    original.every((block, index) => block === proposed[index])
  ) {
    return 0;
  }

  return countWithLcs(original, proposed);
}

