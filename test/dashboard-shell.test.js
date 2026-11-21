import test from 'node:test';
import assert from 'node:assert/strict';
import { createDashboardShell } from '../src/dashboard-shell.js';

test('dashboard shell separates global navigation from the editor workspace', () => {
  const shell = createDashboardShell('article');
  assert.deepEqual(shell.topbar, ['menu','brand','search','status','account']);
  assert.equal(shell.sidebar.navigation.some(item => item.id === 'domain-migration'), true);
  assert.ok(shell.editor.tools.includes('seo-intelligence'));
  assert.ok(shell.sidebar.newContent.includes('new-article'));
});

test('page editor uses page-specific tools and remains inside the same shell', () => {
  const shell = createDashboardShell('page');
  assert.equal(shell.editor.documentType, 'page');
  assert.equal(shell.editor.tools.includes('seo-intelligence'), false);
  assert.equal(shell.responsive.mobile, 'sidebar-drawer');
});

test('dashboard shell can represent a global screen without an editor', () => {
  assert.equal(createDashboardShell().editor, null);
});
