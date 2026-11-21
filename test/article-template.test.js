import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ARTICLE_TEMPLATE_VERSION,
  createArticleViewModel,
  renderArticleTemplate
} from '../src/article-template.js';

test('template keeps presentation slots owned by the platform', () => {
  const model = createArticleViewModel({
    article: { title: 'Título', meta_description: 'Meta' },
    bodyHtml: '<p>Corpo</p>',
    interactions: [{ type: 'calculator', title: 'Calc' }],
    carousel: [{ title: 'Relacionado', url: 'https://example.com/a' }]
  });

  assert.equal(model.template_version, ARTICLE_TEMPLATE_VERSION);
  assert.equal(model.slots.header.title, 'Título');
  assert.equal(model.slots.body, '<p>Corpo</p>');
});

test('template renders slots and escapes link data', () => {
  const html = renderArticleTemplate(createArticleViewModel({
    article: { title: 'Título' },
    bodyHtml: '<p>Corpo</p>',
    carousel: [{
      title: '<Relacionado>',
      url: 'https://example.com/?q="x"'
    }]
  }));

  assert.match(html, /data-template-version="1"/);
  assert.match(html, /data-slot="body"/);
  assert.match(html, /&lt;Relacionado&gt;/);
  assert.match(html, /&quot;x&quot;/);
});
