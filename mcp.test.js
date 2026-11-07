import { test } from 'node:test';
import assert from 'node:assert/strict';

test('MCP endpoint module structure is present', async () => {
  const mod = await import('../src/index.js');
  assert.ok(mod);
});
