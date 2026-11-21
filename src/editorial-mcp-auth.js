import { sha256, safeEqual } from './security.js';

export function isEditorialMcpOriginAllowed(origin, env = process.env) {
  if (!origin) return true;
  const allowed = String(env.MCP_EDITORIAL_ALLOWED_ORIGINS || '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);
  return allowed.includes(origin);
}

export function isEditorialMcpMethodAllowed(method) {
  return String(method || '').toUpperCase() === 'POST';
}

export function isEditorialMcpConfigured(env = process.env) {
  return Boolean(
    env.MCP_EDITORIAL_TOKEN &&
    env.MCP_EDITORIAL_BLOG_ID
  );
}

export function authorizeEditorialMcpRequest(req, env = process.env) {
  if (!isEditorialMcpConfigured(env)) return false;

  const header = String(req.headers.authorization || '');
  if (!header.startsWith('Bearer ')) return false;

  const presented = header.slice(7);
  if (!presented) return false;

  return safeEqual(
    sha256(presented),
    sha256(env.MCP_EDITORIAL_TOKEN)
  );
}

export function syncAgeSeconds(syncedAt, now = Date.now()) {
  if (!syncedAt) return null;
  const ms = now - new Date(syncedAt).getTime();
  return Number.isFinite(ms) && ms >= 0
    ? Math.floor(ms / 1000)
    : null;
}
