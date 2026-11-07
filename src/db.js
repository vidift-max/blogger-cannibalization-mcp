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
  const sql = await fs.readFile(path.join(process.cwd(), 'db/migrations/001_initial.sql'), 'utf8');
  await pool.query(sql);
}
export async function query(text, params = []) { return pool.query(text, params); }
