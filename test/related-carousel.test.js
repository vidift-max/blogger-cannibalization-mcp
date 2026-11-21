import test from 'node:test';
import assert from 'node:assert/strict';

import { selectRelatedCarousel } from '../src/related-carousel.js';

test('related carousel excludes the current article and invalid URLs', () => {
  const result = selectRelatedCarousel({
    article: {
      id: '1',
      title: 'Como economizar dinheiro',
      primary_topic: 'economizar dinheiro',
      labels: ['economia']
    },
    candidates: [
      { id: '1', title: 'Atual', url: 'https://example.com/1' },
      { id: '2', title: 'Como economizar dinheiro em casa', url: 'https://example.com/2' },
      { id: '3', title: 'Outro artigo', url: '' }
    ]
  });

  assert.equal(result.length, 1);
  assert.equal(result[0].id, '2');
  assert.ok(result[0].relevance_score > 0);
});

test('related carousel respects the platform limit', () => {
  const candidates = Array.from({ length: 10 }, (_, i) => ({
    id: String(i + 2),
    title: 'Economizar dinheiro ' + i,
    primary_topic: 'economizar dinheiro',
    labels: ['economia'],
    url: 'https://example.com/' + (i + 2)
  }));

  const result = selectRelatedCarousel({
    article: {
      id: '1',
      title: 'Economizar dinheiro',
      primary_topic: 'economizar dinheiro'
    },
    candidates,
    limit: 99
  });

  assert.equal(result.length, 6);
});
