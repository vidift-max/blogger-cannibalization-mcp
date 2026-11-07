import 'dotenv/config';

const num = (v, d) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : d;
};

export const config = {
  blogUrl: (process.env.BLOG_URL || 'https://www.statesidemoney.com').replace(/\/+$/, ''),
  feedPath: '/feeds/posts/default',
  port: num(process.env.PORT, 3000),
  dbPath: process.env.DB_PATH || './data/index.db',
  pageSize: Math.min(num(process.env.FEED_PAGE_SIZE, 25), 500),
  refreshTtlMs: num(process.env.REFRESH_TTL_MS, 15 * 60 * 1000),
  fullSyncIntervalMs: num(process.env.FULL_SYNC_INTERVAL_MS, 24 * 60 * 60 * 1000),
  contentMaxChars: num(process.env.CONTENT_MAX_CHARS, 12000),
  authToken: process.env.MCP_AUTH_TOKEN || null,
  userAgent: 'blogger-cannibalization-mcp/1.0 (read-only)',
  fetchTimeoutMs: 45000,
  maxRetries: 3,
};