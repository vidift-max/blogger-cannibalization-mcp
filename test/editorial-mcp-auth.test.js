import test from 'node:test';
import assert from 'node:assert/strict';

import {
  isEditorialMcpConfigured,
  authorizeEditorialMcpRequest
} from '../src/editorial-mcp-auth.js';

const env = {
  MCP_EDITORIAL_TOKEN: 'editorial-secret',
  MCP_EDITORIAL_BLOG_ID: 'blog-123'
};

test('MCP configuration requires both token and scoped blog', () => {
  assert.equal(isEditorialMcpConfigured(env), true);
  assert.equal(
    isEditorialMcpConfigured({ MCP_EDITORIAL_TOKEN: 'x' }),
    false
  );
  assert.equal(
    isEditorialMcpConfigured({ MCP_EDITORIAL_BLOG_ID: 'blog-123' }),
    false
  );
});

test('MCP bearer authorization accepts only the configured token', () => {
  const good = {
    headers: { authorization: 'Bearer editorial-secret' }
  };
  const bad = {
    headers: { authorization: 'Bearer wrong-secret' }
  };
  const missing = { headers: {} };

  assert.equal(authorizeEditorialMcpRequest(good, env), true);
  assert.equal(authorizeEditorialMcpRequest(bad, env), false);
  assert.equal(authorizeEditorialMcpRequest(missing, env), false);
});
