import test from 'node:test';
import assert from 'node:assert/strict';
import { replaceDomainInHtml, replaceDomainInText, planDomainMigration, planThemeMigration } from '../src/domain-migration.js';

test('replaces old domain in link and image URL attributes', () => {
  const result = replaceDomainInHtml('<a href="https://old.example.com/post">Post</a><img src="https://www.old.example.com/img.jpg">', 'old.example.com', 'new.example.com');
  assert.equal(result.replacements, 2);
  assert.match(result.html, /https:\/\/new\.example\.com\/post/);
  assert.match(result.html, /https:\/\/new\.example\.com\/img\.jpg/);
});

test('preserves external domains and plain text mentions', () => {
  const html = '<a href="https://other.example.com/x">x</a><p>old.example.com</p>';
  const result = replaceDomainInHtml(html, 'old.example.com', 'new.example.com');
  assert.equal(result.replacements, 0);
  assert.equal(result.html, html);
});

test('replaces domain while preserving path, query and fragment', () => {
  const result = replaceDomainInText('https://old.example.com/a?q=1#top', 'old.example.com', 'new.example.com');
  assert.equal(result.replacements, 1);
  assert.equal(result.text, 'https://new.example.com/a?q=1#top');
});

test('creates a migration plan with original content and counts', () => {
  const plan = planDomainMigration([
    { type: 'article', source_id: '1', content_html: '<a href="https://old.example.com/a">A</a>' },
    { type: 'page', source_id: '2', content_html: '<p>Nothing</p>' }
  ], 'old.example.com', 'new.example.com');
  assert.equal(plan[0].changed, true);
  assert.equal(plan[0].replacements, 1);
  assert.equal(plan[1].changed, false);
  assert.equal(plan[1].replacements, 0);
  assert.equal(plan[0].original_content_html.includes('old.example.com'), true);
});


test('creates a theme migration plan and preserves the original theme', () => {
  const theme = '<a href="https://old.example.com/home">Home</a><script>const x = "https://other.example.com";</script>';
  const plan = planThemeMigration(theme, 'old.example.com', 'new.example.com');
  assert.equal(plan.changed, true);
  assert.equal(plan.replacements, 1);
  assert.equal(plan.original_theme_html, theme);
  assert.match(plan.theme_html, /https:\/\/new\.example\.com\/home/);
  assert.match(plan.theme_html, /https:\/\/other\.example\.com/);
});
