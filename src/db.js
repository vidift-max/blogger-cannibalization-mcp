import pg from 'pg';
import fs from 'node:fs/promises';
import path from 'node:path';

const { Pool } = pg;
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL não configurada.');

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
  max: 10,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000
});

export async function migrate() {
  const migrationsDir = path.join(process.cwd(), 'db/migrations');
  const names = (await fs.readdir(migrationsDir))
    .filter(name => /^\d+_[a-z0-9_-]+\.sql$/i.test(name))
    .sort();
  const client = await pool.connect();
  try {
    await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())');
    await client.query('SELECT pg_advisory_lock($1)', [721946203]);
    try {
      for (const name of names) {
        const alreadyApplied = await client.query('SELECT 1 FROM schema_migrations WHERE name=$1', [name]);
        if (alreadyApplied.rowCount) continue;
        const sql = await fs.readFile(path.join(migrationsDir, name), 'utf8');
        await client.query('BEGIN');
        try {
          await client.query(sql);
          await client.query('INSERT INTO schema_migrations(name) VALUES($1)', [name]);
          await client.query('COMMIT');
        } catch (error) {
          await client.query('ROLLBACK');
          throw new Error('Migration ' + name + ' failed: ' + error.message, { cause: error });
        }
      }
    } finally {
      await client.query('SELECT pg_advisory_unlock($1)', [721946203]);
    }
  } finally {
    client.release();
  }
}

export async function query(text, params = []) {
  return pool.query(text, params);
}
