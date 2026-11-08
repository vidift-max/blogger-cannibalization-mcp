
import express from 'express';
import multer from 'multer';
import yauzl from 'yauzl';
import { pool, query } from './db.js';
import { countChangedSections } from './diff-count.js';

const MAX_ZIP = 50 * 1024 * 1024;
const MAX_TOTAL = 100 * 1024 * 1024;
const MAX_HTML = 5 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_ZIP,
    files: 1,
    fields: 0,
    parts: 1
  }
}).single('file');

function readZip(buffer) {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(buffer, {
      lazyEntries: true,
      autoClose: true,
      decodeStrings: true,
      validateEntrySizes: true,
      strictFileNames: true
    }, (error, zip) => {
      if (error) return reject(new Error('ZIP inválido ou corrompido.'));

      const files = new Map();
      const names = new Set();
      let count = 0;
      let total = 0;
      let finished = false;

      function fail(message) {
        if (finished) return;
        finished = true;
        try { zip.close(); } catch {}
        reject(new Error(message));
      }

      zip.on('error', () => fail('Erro ao ler o ZIP.'));

      zip.on('end', () => {
        if (!finished) {
          finished = true;
          resolve(files);
        }
      });

      zip.on('entry', entry => {
        if (finished) return;

        count++;

        if (count > 1100) {
          return fail('O ZIP contém arquivos demais.');
        }

        const name = String(entry.fileName || '');

        if (
          !name ||
          name.includes('\\') ||
          name.startsWith('/') ||
          /^[a-zA-Z]:/.test(name) ||
          name.split('/').includes('..')
        ) {
          return fail('Caminho inválido dentro do ZIP.');
        }

        if (name.endsWith('/')) {
          zip.readEntry();
          return;
        }

        const lower = name.toLowerCase();

        if (names.has(lower)) {
          return fail('Existem arquivos duplicados no ZIP.');
        }

        names.add(lower);

        const mode =
          (entry.externalFileAttributes >>> 16) & 0o170000;

        if (mode === 0o120000) {
          return fail('Links simbólicos não são permitidos.');
        }

        const manifest = name === 'manifest.json';
        const article = /^artigos\/[^/]+\.html$/i.test(name);

        if (!manifest && !article) {
          return fail('Arquivo fora da estrutura esperada: ' + name);
        }

        const limit = manifest
          ? 2 * 1024 * 1024
          : MAX_HTML;

        if (
          !Number.isFinite(entry.uncompressedSize) ||
          entry.uncompressedSize > limit
        ) {
          return fail('Um arquivo ultrapassa o limite permitido.');
        }

        total += entry.uncompressedSize;

        if (total > MAX_TOTAL) {
          return fail('O ZIP descompactado ultrapassa 100 MB.');
        }

        zip.openReadStream(entry, (streamError, stream) => {
          if (streamError) {
            return fail('Não foi possível ler um arquivo interno.');
          }

          const chunks = [];
          let received = 0;

          stream.on('data', chunk => {
            received += chunk.length;

            if (received > limit) {
              stream.destroy();
              return fail('Arquivo interno maior que o permitido.');
            }

            chunks.push(chunk);
          });

          stream.on('error', () => {
            fail('Um arquivo interno está corrompido.');
          });

          stream.on('end', () => {
            if (finished) return;

            if (received !== entry.uncompressedSize) {
              return fail('Tamanho de arquivo interno inválido.');
            }

            files.set(name, Buffer.concat(chunks));
            zip.readEntry();
          });
        });
      });

      zip.readEntry();
    });
  });
}

function sameDate(a, b) {
  if (!a && !b) return true;
  if (!a || !b) return false;

  return new Date(a).getTime() === new Date(b).getTime();
}

export function createZipImportRouter({
  currentUser,
  requireCsrf,
  audit
}) {
  const router = express.Router();

  function receiveZip(req, res, next) {
    upload(req, res, error => {
      if (error) {
        const tooLarge = error.code === 'LIMIT_FILE_SIZE';

        return res.status(tooLarge ? 413 : 400).json({
          error: tooLarge ? 'zip_too_large' : 'invalid_upload',
          message: tooLarge
            ? 'O ZIP ultrapassa 50 MB.'
            : 'Não foi possível receber o ZIP.'
        });
      }

      next();
    });
  }

  router.post(
    '/blogs/:blogId/import-corrections',
    currentUser,
    receiveZip,
    requireCsrf,
    async (req, res, next) => {
      const client = await pool.connect();

      try {
        if (!req.file?.buffer) {
          return res.status(400).json({
            error: 'zip_required',
            message: 'Selecione o ZIP corrigido.'
          });
        }

        const blogResult = await query(
          `SELECT id, blogger_blog_id
           FROM blogs
           WHERE id=$1 AND user_id=$2`,
          [req.params.blogId, req.user.id]
        );

        if (!blogResult.rowCount) {
          return res.status(404).json({
            error: 'blog_not_found'
          });
        }

        const blog = blogResult.rows[0];
        const files = await readZip(req.file.buffer);
        const manifestBuffer = files.get('manifest.json');

        if (!manifestBuffer) {
          return res.status(400).json({
            error: 'manifest_missing',
            message: 'O ZIP precisa conter o manifest.json original.'
          });
        }

        let manifest;

        try {
          manifest = JSON.parse(manifestBuffer.toString('utf8'));
        } catch {
          return res.status(400).json({
            error: 'manifest_invalid',
            message: 'O manifesto não contém JSON válido.'
          });
        }

        if (
          manifest?.version !== 1 ||
          String(manifest?.blog?.id) !== String(blog.id) ||
          String(manifest?.blog?.bloggerBlogId) !==
            String(blog.blogger_blog_id) ||
          !Array.isArray(manifest?.articles) ||
          manifest.articles.length < 1 ||
          manifest.articles.length > 1000 ||
          Number(manifest.totalArticles) !== manifest.articles.length
        ) {
          return res.status(409).json({
            error: 'manifest_mismatch',
            message: 'O manifesto não corresponde ao blog selecionado.'
          });
        }

        const postsResult = await query(
          `SELECT
             id,
             blogger_post_id,
             title,
             url,
             content_html,
             updated_at
           FROM posts
           WHERE blog_id=$1 AND user_id=$2`,
          [blog.id, req.user.id]
        );

        if (postsResult.rowCount !== manifest.articles.length) {
          return res.status(409).json({
            error: 'article_count_mismatch',
            message: 'A quantidade de artigos não corresponde à sincronização atual. Sincronize novamente e gere outro ZIP.'
          });
        }

        const posts = new Map(
          postsResult.rows.map(p => [String(p.id), p])
        );

        const seenIds = new Set();
        const seenFiles = new Set();
        const items = [];

        for (const article of manifest.articles) {
          const id = String(article?.databaseId ?? '');
          const bloggerId = String(article?.bloggerPostId ?? '');
          const file = String(article?.file ?? '');

          if (
            !id ||
            !bloggerId ||
            !/^artigos\/[^/]+\.html$/i.test(file) ||
            seenIds.has(id) ||
            seenFiles.has(file)
          ) {
            return res.status(400).json({
              error: 'manifest_article_invalid',
              message: 'O manifesto contém identificadores duplicados ou inválidos.'
            });
          }

          seenIds.add(id);
          seenFiles.add(file);

          const post = posts.get(id);

          if (!post || String(post.blogger_post_id) !== bloggerId) {
            return res.status(409).json({
              error: 'article_identity_mismatch',
              message: 'Um artigo não corresponde aos identificadores originais.'
            });
          }

          if (!sameDate(article.updatedAt, post.updated_at)) {
            return res.status(409).json({
              error: 'stale_zip',
              message: 'Os artigos foram sincronizados depois da criação deste ZIP. Gere um ZIP atualizado.'
            });
          }

          const content = files.get(file);

          if (!content) {
            return res.status(400).json({
              error: 'article_file_missing',
              message: 'Está faltando o arquivo ' + file
            });
          }

          const html = content.toString('utf8');

          if (!html.trim() || html.includes('\u0000')) {
            return res.status(400).json({
              error: 'article_html_invalid',
              message: 'O arquivo ' + file + ' está vazio ou inválido.'
            });
          }

          items.push({ post, html });
        }

        const expectedFiles = new Set([
          'manifest.json',
          ...manifest.articles.map(a => String(a.file))
        ]);

        if (files.size !== expectedFiles.size) {
          return res.status(400).json({
            error: 'unexpected_zip_files',
            message: 'O ZIP contém arquivos extras ou não listados no manifesto.'
          });
        }

        await client.query('BEGIN');

        const locked = await client.query(
          `SELECT id, blogger_post_id, updated_at
           FROM posts
           WHERE blog_id=$1 AND user_id=$2
           FOR UPDATE`,
          [blog.id, req.user.id]
        );

        if (locked.rowCount !== postsResult.rowCount) {
          throw new Error('A lista de artigos mudou durante a importação.');
        }

        const pending = await client.query(
          `SELECT 1
           FROM post_backups
           WHERE user_id=$1
             AND status='pending'
             AND post_id = ANY($2::bigint[])
           LIMIT 1`,
          [req.user.id, items.map(i => i.post.id)]
        );

        if (pending.rowCount) {
          await client.query('ROLLBACK');

          return res.status(409).json({
            error: 'pending_proposals_exist',
            message: 'Existem propostas pendentes. Revise ou rejeite as anteriores antes de importar outro ZIP.'
          });
        }

        const created = [];

        for (const item of items) {
          const previousHtml = item.post.content_html || '';

          const changeCount = countChangedSections(
            previousHtml,
            item.html
          );

          const result = await client.query(
            `INSERT INTO post_backups(
               user_id,
               post_id,
               previous_html,
               proposed_html,
               change_count
             )
             VALUES($1,$2,$3,$4,$5)
             RETURNING id,status,created_at,change_count`,
            [
              req.user.id,
              item.post.id,
              previousHtml,
              item.html,
              changeCount
            ]
          );

          created.push({
            id: result.rows[0].id,
            postId: item.post.id,
            title: item.post.title,
            url: item.post.url,
            status: result.rows[0].status,
            changeCount: result.rows[0].change_count
          });
        }

        await client.query('COMMIT');

        await audit(req.user.id, 'corrections_zip_imported', {
          blogId: blog.id,
          proposals: created.length
        });

        res.status(201).json({
          ok: true,
          published: false,
          total: created.length,
          proposals: created,
          message: 'ZIP validado. Propostas e backups salvos. Nada foi publicado no Blogger.'
        });
      } catch (error) {
        try {
          await client.query('ROLLBACK');
        } catch {}

        next(error);
      } finally {
        client.release();
      }
    }
  );

  router.get(
    '/proposals/:id',
    currentUser,
    async (req, res, next) => {
      try {
        const result = await query(
          `SELECT
             pb.id,
             pb.post_id,
             pb.status,
             pb.previous_html,
             pb.proposed_html,
             pb.change_count,
             pb.created_at,
             p.title,
             p.url
           FROM post_backups pb
           JOIN posts p ON p.id=pb.post_id
           WHERE pb.id=$1
             AND pb.user_id=$2
             AND p.user_id=$2`,
          [req.params.id, req.user.id]
        );

        if (!result.rowCount) {
          return res.status(404).json({
            error: 'proposal_not_found'
          });
        }

        res.json({ proposal: result.rows[0] });
      } catch (error) {
        next(error);
      }
    }
  );

  router.post(
    '/proposals/:id/reject',
    currentUser,
    requireCsrf,
    async (req, res, next) => {
      try {
        const result = await query(
          `UPDATE post_backups
           SET status='rejected'
           WHERE id=$1
             AND user_id=$2
             AND status='pending'
           RETURNING id,status`,
          [req.params.id, req.user.id]
        );

        if (!result.rowCount) {
          return res.status(404).json({
            error: 'pending_proposal_not_found'
          });
        }

        await audit(req.user.id, 'proposal_rejected', {
          proposalId: result.rows[0].id
        });

        res.json({
          ok: true,
          proposal: result.rows[0]
        });
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}
