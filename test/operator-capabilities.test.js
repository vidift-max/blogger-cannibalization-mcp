import test from 'node:test';
import assert from 'node:assert/strict';
import { canOperatorPublish, createOperatorSession, grantPublishCapability } from '../src/operator-capabilities.js';

test('remote operator can prepare but cannot publish by default', () => {
  const session = createOperatorSession({ remote: true });
  assert.ok(session.capabilities.prepare.includes('import_claude_html'));
  assert.equal(canOperatorPublish(session), false);
});

test('publishing capability requires explicit user approval', () => {
  const session = createOperatorSession({ remote: true });
  assert.throws(() => grantPublishCapability(session), /explicit_user_approval_required/);
  session.user_approved = true;
  grantPublishCapability(session);
  assert.equal(canOperatorPublish(session), true);
});
