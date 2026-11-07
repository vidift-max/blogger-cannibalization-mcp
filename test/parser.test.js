import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAtom, htmlToText } from '../src/parser.js';

const SAMPLE = `<?xml version='1.0' encoding='UTF-8'?>
<feed xmlns='http://www.w3.org/2005/Atom' xmlns:openSearch='http://a9.com/-/spec/opensearchrss/1.0/'>
<openSearch:totalResults>53</openSearch:totalResults>
<entry>
<id>tag:blogger.com,1999:blog-6363285585441237974.post-123</id>
<published>2026-11-07T02:53:04.365-08:00</published>
<updated>2026-11-07T03:33:26.119-08:00</updated>
<category scheme="http://www.blogger.com/atom/ns#" term="Mortgage Rates"/>
<title type='text'>Mortgage Rates Today</title>
<content type='html'>&lt;!-- og comment --&gt;&lt;script&gt;alert(1)&lt;/script&gt;&lt;style&gt;.x{}&lt;/style&gt;&lt;h1&gt;Mortgage Rates Today&lt;/h1&gt;&lt;p&gt;Rates fell this week.&lt;/p&gt;</content>
<link rel='edit' href='https://www.blogger.com/feeds/6363285585441237974/posts/default/999'/>
<link rel='alternate' type='text/html' href='https://www.statesidemoney.com/2026/11/mortgage-rates.html'/>
</entry></feed>`;

test('parser extrai todos os campos do Atom do Blogger', () => {
  const { feedMeta, entries } = parseAtom(SAMPLE);
  assert.equal(feedMeta.totalResults, 53);
  const e = entries[0];
  assert.equal(e.title, 'Mortgage Rates Today');
  assert.equal(e.numericId, '999');
  assert.equal(e.url, 'https://www.statesidemoney.com/2026/11/mortgage-rates.html');
  assert.deepEqual(e.labels, ['Mortgage Rates']);
  assert.match(e.published, /^2026-11-07/);
  assert.ok(e.textClean.includes('Rates fell this week'));
  assert.ok(!e.textClean.includes('alert(1)'), 'script não pode vazar');
  assert.ok(!e.textClean.includes('og comment'), 'comentário não pode vazar');
  assert.deepEqual(e.headings, ['Mortgage Rates Today']);
});

test('htmlToText remove CSS/JS e colapsa espaços', () => {
  const { text } = htmlToText('<style>p{color:red}</style><p>Hello  world</p><script>x()</script>');
  assert.equal(text, 'Hello world');
});