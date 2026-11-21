import test from 'node:test';
import assert from 'node:assert/strict';

import { handleEditorialMcp } from '../src/editorial-mcp.js';

function mockResponse() {
  return {
    headers: {},
    statusCode: 200,
    body: null,
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
    on() {}
  };
}

function withEnv(values, fn) {
  const previous = {};
  for (const [key, value] of Object.entries(values)) {
    previous[key] = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  return Promise.resolve(fn()).finally(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
}

test('MCP route rejects non-POST before authentication', async () => {
  const req = { method: 'GET', headers: {} };
  const res = mockResponse();

  await handleEditorialMcp(req, res);

  assert.equal(res.statusCode, 405);
  assert.equal(res.headers.Allow, 'POST');
  assert.deepEqual(res.body, { error: 'method_not_allowed' });
});

test('MCP route stays unavailable when bridge credentials are absent', async () => {
  await withEnv({
    MCP_EDITORIAL_TOKEN: undefined,
    MCP_EDITORIAL_BLOG_ID: undefined
  }, async () => {
    const req = { method: 'POST', headers: {}, body: {} };
    const res = mockResponse();

    await handleEditorialMcp(req, res);

    assert.equal(res.statusCode, 503);
    assert.deepEqual(res.body, { error: 'editorial_mcp_not_configured' });
  });
});

test('MCP route rejects an unlisted Origin before token validation', async () => {
  await withEnv({
    MCP_EDITORIAL_TOKEN: 'editorial-secret',
    MCP_EDITORIAL_BLOG_ID: 'blog-123',
    MCP_EDITORIAL_ALLOWED_ORIGINS: 'https://allowed.example'
  }, async () => {
    const req = {
      method: 'POST',
      headers: { origin: 'https://evil.example' },
      body: {}
    };
    const res = mockResponse();

    await handleEditorialMcp(req, res);

    assert.equal(res.statusCode, 403);
    assert.deepEqual(res.body, { error: 'origin_not_allowed' });
  });
});

test('MCP route rejects missing or invalid bearer credentials', async () => {
  await withEnv({
    MCP_EDITORIAL_TOKEN: 'editorial-secret',
    MCP_EDITORIAL_BLOG_ID: 'blog-123',
    MCP_EDITORIAL_ALLOWED_ORIGINS: undefined
  }, async () => {
    for (const authorization of [undefined, 'Bearer wrong-secret']) {
      const req = {
        method: 'POST',
        headers: authorization ? { authorization } : {},
        body: {}
      };
      const res = mockResponse();

      await handleEditorialMcp(req, res);

      assert.equal(res.statusCode, 401);
      assert.equal(res.headers['WWW-Authenticate'], 'Bearer');
      assert.deepEqual(res.body, { error: 'unauthorized' });
    }
  });
});
