import test from 'node:test';
import assert from 'node:assert/strict';

import {
  isEditorialMcpConfigured,
  isEditorialMcpOriginAllowed,
  isEditorialMcpMethodAllowed,
  authorizeEditorialMcpRequest,
  syncAgeSeconds,
  syncFreshness
} from '../src/editorial-mcp-auth.js';

const env = {
  MCP_EDITORIAL_TOKEN: 'editorial-secret',
  MCP_EDITORIAL_BLOG_ID: 'blog-123'
};

test('MCP Origin policy rejects unlisted browser origins', () => {
  assert.equal(isEditorialMcpOriginAllowed('', env), true);
  assert.equal(isEditorialMcpOriginAllowed('https://allowed.example', {
    ...env,
    MCP_EDITORIAL_ALLOWED_ORIGINS: 'https://allowed.example'
  }), true);
  assert.equal(isEditorialMcpOriginAllowed('https://evil.example', {
    ...env,
    MCP_EDITORIAL_ALLOWED_ORIGINS: 'https://allowed.example'
  }), false);
});

test('MCP endpoint allows only POST in stateless mode', () => {
  assert.equal(isEditorialMcpMethodAllowed('POST'), true);
  assert.equal(isEditorialMcpMethodAllowed('GET'), false);
  assert.equal(isEditorialMcpMethodAllowed('DELETE'), false);
});

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
  assert.equal(
    isEditorialMcpConfigured({ MCP_EDITORIAL_TOKEN: '', MCP_EDITORIAL_BLOG_ID: 'blog-123' }),
    false
  );
  assert.equal(
    isEditorialMcpConfigured({ MCP_EDITORIAL_TOKEN: '   ', MCP_EDITORIAL_BLOG_ID: 'blog-123' }),
    false
  );
  assert.equal(
    isEditorialMcpConfigured({ MCP_EDITORIAL_TOKEN: 'secret', MCP_EDITORIAL_BLOG_ID: '   ' }),
    false
  );
  assert.equal(
    isEditorialMcpConfigured({ MCP_EDITORIAL_TOKEN: 'secret', MCP_EDITORIAL_BLOG_ID: '' }),
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
  assert.equal(authorizeEditorialMcpRequest(good, {
    ...env,
    MCP_EDITORIAL_TOKEN: '  editorial-secret  '
  }), true);
  assert.equal(authorizeEditorialMcpRequest({
    headers: { authorization: 'Bearer  editorial-secret  ' }
  }, env), false);
  assert.equal(authorizeEditorialMcpRequest({
    headers: { authorization: 'bearer editorial-secret' }
  }, env), true);
  assert.equal(authorizeEditorialMcpRequest({
    headers: { authorization: 'bEaReR editorial-secret' }
  }, env), true);
  assert.equal(authorizeEditorialMcpRequest({
    headers: { authorization: 'Bearer ' }
  }, env), false);
  assert.equal(authorizeEditorialMcpRequest({
    headers: { authorization: 'Bearer editorial-secret extra' }
  }, env), false);
  assert.equal(authorizeEditorialMcpRequest(bad, env), false);
  assert.equal(authorizeEditorialMcpRequest(missing, env), false);
});

test('MCP freshness reports elapsed synchronization age', () => {
  const now = Date.parse('2026-11-20T22:00:10Z');
  assert.equal(
    syncAgeSeconds('2026-11-20T22:00:00Z', now),
    10
  );
  assert.equal(syncAgeSeconds(null, now), null);
  assert.equal(syncAgeSeconds('not-a-date', now), null);
  assert.equal(
    syncAgeSeconds('2026-11-20T22:00:20Z', now),
    null
  );
});


test('MCP corpus freshness distinguishes fresh, stale and unknown sync state', () => {
  const now = Date.parse('2026-11-20T22:00:10Z');

  assert.deepEqual(
    syncFreshness('2026-11-20T22:00:00Z', now, 60),
    { status: 'fresh', max_age_seconds: 60 }
  );
  assert.deepEqual(
    syncFreshness('2026-11-20T21:58:00Z', now, 60),
    { status: 'stale', max_age_seconds: 60 }
  );
  assert.deepEqual(
    syncFreshness(null, now, 60),
    { status: 'unknown', max_age_seconds: 60 }
  );
  assert.deepEqual(
    syncFreshness('2026-11-20T22:00:00Z', now, 'invalid'),
    { status: 'fresh', max_age_seconds: 86400 }
  );
  assert.deepEqual(
    syncFreshness('2026-11-20T22:00:00Z', now, ''),
    { status: 'fresh', max_age_seconds: 86400 }
  );
  assert.deepEqual(
    syncFreshness('2026-11-20T22:00:00Z', now, '   '),
    { status: 'fresh', max_age_seconds: 86400 }
  );
  assert.deepEqual(
    syncFreshness('2026-11-20T22:00:10Z', now, '0'),
    { status: 'fresh', max_age_seconds: 0 }
  );
  assert.deepEqual(
    syncFreshness('2026-11-20T22:00:09Z', now, '0'),
    { status: 'stale', max_age_seconds: 0 }
  );
});
