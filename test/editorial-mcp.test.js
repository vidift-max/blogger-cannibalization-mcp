import test from 'node:test';
import assert from 'node:assert/strict';

import { getEditorialMcpConfig } from '../src/editorial-mcp.js';

test('editorial MCP stays disabled without explicit bridge credentials', async () => {
  const priorToken = process.env.MCP_EDITORIAL_TOKEN;
  const priorBlog = process.env.MCP_EDITORIAL_BLOG_ID;

  delete process.env.MCP_EDITORIAL_TOKEN;
  delete process.env.MCP_EDITORIAL_BLOG_ID;

  try {
    const config = await getEditorialMcpConfig();

    assert.equal(config.configured, false);
    assert.equal(config.blog_id, null);
    assert.equal('token' in config, false);
    assert.equal('MCP_EDITORIAL_TOKEN' in config, false);
  } finally {
    if (priorToken === undefined) delete process.env.MCP_EDITORIAL_TOKEN;
    else process.env.MCP_EDITORIAL_TOKEN = priorToken;

    if (priorBlog === undefined) delete process.env.MCP_EDITORIAL_BLOG_ID;
    else process.env.MCP_EDITORIAL_BLOG_ID = priorBlog;
  }
});
