import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const routes = await readFile(new URL('../src/routes.js', import.meta.url), 'utf8');
const ui = await readFile(new URL('../public/proposals.html', import.meta.url), 'utf8');
const migration = await readFile(new URL('../db/migrations/002_proposal_lifecycle.sql', import.meta.url), 'utf8');
const batches = await readFile(new URL('../src/correction-batches.js', import.meta.url), 'utf8');

test('interface proposal routes exist in the API', () => {
  for (const route of [
    "'/proposals/:id'",
    "'/proposals/:id/reject'",
    "'/proposals/:id/approve'",
    "'/proposals/:id/restore'",
    "'/proposals/:id/reconcile'"
  ]) assert.ok(routes.includes(route), 'missing route ' + route);
});

test('approval and restore use persisted in-progress states', () => {
  assert.match(routes, /status='applying'.*reconciliation_action='apply'/s);
  assert.match(routes, /status='restoring'.*reconciliation_action='restore'/s);
  assert.match(routes, /status='reconciliation_required'/);
});

test('reconciliation compares remote content and does not publish it', () => {
  const start = routes.indexOf("router.post('/proposals/:id/reconcile'");
  assert.ok(start >= 0);
  const reconcileRoute = routes.slice(start);
  assert.match(reconcileRoute, /remoteHtml === row\.proposed_html/);
  assert.match(reconcileRoute, /remoteHtml === row\.previous_html/);
  assert.doesNotMatch(reconcileRoute, /updatePost\(/);
});

test('migration permits all lifecycle states and records reconciliation context', () => {
  for (const state of ['pending','applying','applied','restoring','restored','rejected','reconciling','reconciliation_required']) {
    assert.ok(migration.includes("'" + state + "'"));
  }
  assert.ok(migration.includes('reconciliation_action'));
  assert.ok(migration.includes('reconciliation_reason'));
});

test('batch item detail is constrained to the authenticated owner', () => {
  assert.match(batches, /WHERE cbi\.batch_id=\$1\s+AND p\.user_id=\$2/);
});

test('proposal interface exposes restore and reconciliation actions', () => {
  assert.ok(ui.includes("performAction('restore')"));
  assert.ok(ui.includes("performAction('reconcile')"));
  assert.ok(ui.includes("Requer reconciliação"));
});
