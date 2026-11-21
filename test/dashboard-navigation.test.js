import test from 'node:test';
import assert from 'node:assert/strict';
import { getDashboardNavigation, getContentTools, isGlobalTool, isContentTool } from '../src/dashboard-navigation.js';

test('dashboard navigation keeps global tools outside content editors', () => {
  assert.deepEqual(getDashboardNavigation().map(item => item.id), ['articles','pages','stats','comments','labels','seo-intelligence','domain-migration','theme','settings']);
  assert.equal(isGlobalTool('domain-migration'), true); assert.equal(isGlobalTool('seo-intelligence'), false);
});

test('article tools contain editorial SEO controls while page tools stay smaller', () => {
  const article=getContentTools('article'), page=getContentTools('page');
  assert.ok(article.includes('seo-intelligence')); assert.ok(article.includes('related-articles'));
  assert.ok(page.includes('seo')); assert.equal(page.includes('seo-intelligence'), false);
  assert.equal(isContentTool('seo-intelligence','article'), true); assert.equal(isContentTool('domain-migration','article'), false);
});

test('unknown document types safely use article defaults', () => assert.deepEqual(getContentTools('unknown'), getContentTools('article')));
