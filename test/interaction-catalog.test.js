import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeInteractions } from '../src/interaction-catalog.js';

test('interaction normalization keeps at most four supported interactions', () => {
  const result = normalizeInteractions([
    { type: 'calculator', title: 'A' },
    { type: 'quiz', title: 'B' },
    { type: 'checklist', title: 'C' },
    { type: 'comparison', title: 'D' },
    { type: 'timeline', title: 'E' },
    { type: 'unknown', title: 'X' }
  ]);

  assert.equal(result.length, 4);
  assert.deepEqual(result.map(item => item.type), [
    'calculator', 'quiz', 'checklist', 'comparison'
  ]);
});
