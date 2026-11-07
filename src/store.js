import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import Database from 'better-sqlite3';
import { config } from './config.js';

export function openStore(dbPath = config.dbPath) {
  // CORREÇÃO (bug #5): sem isso, `npm run smoke` quebrava com
  // "unable to open database file" porque a pasta data/ não existia.
  if (dbPath !== ':memory:') mkdirSync(dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS articles (
      id            TEXT PRIMARY KEY,
      numeric_id    TEXT,
      title         TEXT NOT NULL,
      url           TEXT NOT NULL UNIQUE,
      published     TEXT,
      updated       TEXT,
      labels        TEXT NOT NULL DEFAULT '[]',
      content_hash  TEXT NOT NULL,
      content_html  TEXT,
      text_clean    TEXT,
      headings      TEXT NOT NULL DEFAULT '[]',
      excerpt       TEXT,
      word_count    INTEGER DEFAULT 0,
      keywords      TEXT NOT NULL DEFAULT '[]',
      last_checked  TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_articles_updated ON articles(updated);
    CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);
  `);

  const upsert = db.prepare(`
    INSERT INTO articles (id, numeric_id, title, url, published, updated, labels,
      content_hash, content_html, text_clean, headings, excerpt, word_count,
      keywords, last_checked)
    VALUES (@id, @numericId, @title, @url, @published, @updated, @labels,
      @contentHash, @contentHtml, @textClean, @headings, @excerpt, @wordCount,
      @keywords, @lastChecked)
    ON CONFLICT(id) DO UPDATE SET
      numeric_id=@numericId, title=@title, url=@url, published=@published,
      updated=@updated, labels=@labels, content_hash=@contentHash,
      content_html=@contentHtml, text_clean=@textClean, headings=@headings,
      excerpt=@excerpt, word_count=@wordCount, keywords=@keywords,
      last_checked=@lastChecked
  `);
  const findRaw = db.prepare('SELECT * FROM articles WHERE id = ? OR numeric_id = ? OR url = ?');
  const all = db.prepare('SELECT * FROM articles ORDER BY published DESC');
  const delMissing = db.prepare('DELETE FROM articles WHERE id NOT IN (SELECT value FROM json_each(?))');
  const metaGet = db.prepare('SELECT value FROM meta WHERE key = ?');
  const metaSet = db.prepare('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');

  return {
    db,
    upsert,
    findRaw: (ref) => findRaw.get(ref, ref, ref) || null,
    allArticles: () => all.all().map(deserialize),
    articleByRef: (ref) => { const r = findRaw.get(ref, ref, ref); return r ? deserialize(r) : null; },
    deleteNotIn: (ids) => delMissing.run(JSON.stringify(ids)),
    metaGet: (k) => metaGet.get(k)?.value,
    metaSet,
    close: () => db.close(),
  };
}

function deserialize(row) {
  return {
    id: row.id,
    numericId: row.numeric_id,
    title: row.title,
    url: row.url,
    published: row.published,
    updated: row.updated,
    labels: JSON.parse(row.labels),
    contentHash: row.content_hash,
    contentHtml: row.content_html,
    textClean: row.text_clean,
    headings: JSON.parse(row.headings),
    excerpt: row.excerpt,
    wordCount: row.word_count,
    keywords: JSON.parse(row.keywords),
    lastChecked: row.last_checked,
  };
}