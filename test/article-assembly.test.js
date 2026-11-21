import test from 'node:test';
import assert from 'node:assert/strict';

import {
  renderArticleBlocks,
  renderContentBlock
} from '../src/article-assembly.js';

test('assembly maps editorial blocks to fixed semantic HTML', () => {
  assert.equal(
    renderContentBlock({ type: 'heading_2', content: 'Seção principal' }),
    '<h2>Seção principal</h2>'
  );

  assert.equal(
    renderContentBlock({ type: 'paragraph', content: '<script>alert(1)</script>' }),
    '<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>'
  );
});

test('assembly ignores unsupported provider block types', () => {
  assert.equal(
    renderArticleBlocks([
      { type: 'paragraph', content: 'Primeiro.' },
      { type: 'unknown', content: 'Não deve entrar.' },
      { type: 'heading_2', content: 'Segundo.' }
    ]),
    '<p>Primeiro.</p>\n<h2>Segundo.</h2>'
  );
});
