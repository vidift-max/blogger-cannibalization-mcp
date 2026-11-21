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


export function syncFreshness(syncedAt, now = Date.now(), maxAgeSeconds = 86400) {
  const ageSeconds = syncAgeSeconds(syncedAt, now);
  const rawMaxAge = typeof maxAgeSeconds === 'string'
    ? maxAgeSeconds.trim()
    : maxAgeSeconds;
  const configuredMaxAge = rawMaxAge === '' || rawMaxAge === null || rawMaxAge === undefined
    ? NaN
    : Number(rawMaxAge);
  const safeMaxAge = Number.isFinite(configuredMaxAge) && configuredMaxAge >= 0
    ? configuredMaxAge
    : 86400;

  return {
    status: ageSeconds === null
      ? 'unknown'
      : ageSeconds <= safeMaxAge
        ? 'fresh'
        : 'stale',
    max_age_seconds: safeMaxAge
  };
}
