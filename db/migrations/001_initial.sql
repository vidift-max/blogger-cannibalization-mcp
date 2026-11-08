
CREATE TABLE IF NOT EXISTS app_users (
  id BIGSERIAL PRIMARY KEY,
  google_sub TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS oauth_tokens (
  user_id BIGINT PRIMARY KEY REFERENCES app_users(id) ON DELETE CASCADE,
  encrypted_access_token TEXT,
  encrypted_refresh_token TEXT NOT NULL,
  token_expiry TIMESTAMPTZ,
  scopes TEXT[] NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_sessions (
  id_hash TEXT PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  csrf_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_sessions_expiry_idx
ON user_sessions(expires_at);

CREATE TABLE IF NOT EXISTS blogs (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  blogger_blog_id TEXT NOT NULL,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  synced_at TIMESTAMPTZ,
  UNIQUE(user_id, blogger_blog_id)
);

CREATE TABLE IF NOT EXISTS posts (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  blog_id BIGINT NOT NULL REFERENCES blogs(id) ON DELETE CASCADE,
  blogger_post_id TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT,
  content_html TEXT NOT NULL DEFAULT '',
  content_text TEXT NOT NULL DEFAULT '',
  labels TEXT[] NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ,
  UNIQUE(user_id, blog_id, blogger_post_id)
);

CREATE INDEX IF NOT EXISTS posts_user_blog_idx
ON posts(user_id, blog_id);

CREATE TABLE IF NOT EXISTS post_backups (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  post_id BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  previous_html TEXT NOT NULL,
  proposed_html TEXT NOT NULL,
  change_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (
    status IN ('pending','applied','restored','rejected')
  ) DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  applied_at TIMESTAMPTZ,
  restored_at TIMESTAMPTZ
);

-- Adiciona a coluna também às propostas que já existem.
-- Não apaga nem recria as 53 propostas importadas.
ALTER TABLE post_backups
ADD COLUMN IF NOT EXISTS change_count INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS analysis_runs (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  blog_id BIGINT NOT NULL REFERENCES blogs(id) ON DELETE CASCADE,
  result JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_events (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- ============================================================
-- LOTES DE CORREÇÕES
-- ============================================================

CREATE TABLE IF NOT EXISTS correction_batches (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blog_id BIGINT NOT NULL REFERENCES blogs(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',

  total_items INTEGER NOT NULL DEFAULT 0,
  pending_items INTEGER NOT NULL DEFAULT 0,
  approved_items INTEGER NOT NULL DEFAULT 0,
  published_items INTEGER NOT NULL DEFAULT 0,
  rejected_items INTEGER NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- ITENS DOS LOTES DE CORREÇÕES
-- ============================================================

CREATE TABLE IF NOT EXISTS correction_batch_items (
  id BIGSERIAL PRIMARY KEY,

  batch_id BIGINT NOT NULL
    REFERENCES correction_batches(id)
    ON DELETE CASCADE,

  post_id BIGINT NOT NULL
    REFERENCES posts(id)
    ON DELETE CASCADE,

  proposal_id BIGINT
    REFERENCES post_backups(id)
    ON DELETE SET NULL,

  status TEXT NOT NULL DEFAULT 'pending',

  original_html TEXT,
  corrected_html TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(batch_id, post_id)
);


-- ============================================================
-- ÍNDICES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_correction_batches_user
  ON correction_batches(user_id);

CREATE INDEX IF NOT EXISTS idx_correction_batches_blog
  ON correction_batches(blog_id);

CREATE INDEX IF NOT EXISTS idx_correction_batches_created
  ON correction_batches(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_correction_batch_items_batch
  ON correction_batch_items(batch_id);

CREATE INDEX IF NOT EXISTS idx_correction_batch_items_post
  ON correction_batch_items(post_id);

CREATE INDEX IF NOT EXISTS idx_correction_batch_items_status
  ON correction_batch_items(status);
