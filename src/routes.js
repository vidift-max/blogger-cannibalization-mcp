import express from 'express';
import archiver from 'archiver';
import { google } from 'googleapis';
import { createZipImportRouter } from './zip-import.js';
import { createCorrectionBatchesRouter } from './correction-batches.js';
import { pool, query } from './db.js';
import {
  encryptSecret,
  decryptSecret,
  randomToken,
  sha256,
  safeEqual,
  stripHtml
} from './security.js';
import {
  BLOGGER_SCOPE,
  oauthClient,
  listBlogs,
  listPosts,
  listPages,
  getPost,
  updatePost
} from './blogger.js';
import { analyzePosts } from './analysis.js';
import { countChangedSections } from './diff-count.js';

export const router = express.Router();

const SESSION_MS = 14 * 24 * 60 * 60 * 1000;

const cookieOptions = {
  httpOnly: true,
  secure: process.env.COOKIE_SECURE === 'true',
  sameSite: 'lax',
  path: '/'
};

async function currentUser(req, res, next) {
  try {
    const sid = req.cookies?.sid;

    if (!sid) {
      return res.status(401).json({ error: 'not_authenticated' });
    }

    const r = await query(
      `SELECT u.id,u.email,u.display_name,s.csrf_hash
       FROM user_sessions s
       JOIN app_users u ON u.id=s.user_id
       WHERE s.id_hash=$1 AND s.expires_at>now()`,
      [sha256(sid)]
    );

    if (!r.rowCount) {
      return res.status(401).json({ error: 'session_expired' });
    }

    req.user = r.rows[0];
    req.sessionHash = sha256(sid);

    next();
  } catch (e) {
    next(e);
  }
}

function requireCsrf(req, res, next) {
  const token = req.get('x-csrf-token') || req.body?._csrf;

  if (!token || !safeEqual(sha256(token), req.user.csrf_hash)) {
    return res.status(403).json({ error: 'csrf_invalid' });
  }

  next();
}

async function authForUser(userId) {
  const r = await query(
    'SELECT * FROM oauth_tokens WHERE user_id=$1',
    [userId]
  );

  if (!r.rowCount) {
    throw new Error('Google Blogger não conectado.');
  }

  const row = r.rows[0];
  const client = oauthClient();

  client.setCredentials({
    access_token: decryptSecret(row.encrypted_access_token),
    refresh_token: decryptSecret(row.encrypted_refresh_token),
    expiry_date: row.token_expiry
      ? new Date(row.token_expiry).getTime()
      : undefined
  });

  client.on('tokens', async tokens => {
    try {
      await query(
        `UPDATE oauth_tokens SET
          encrypted_access_token=COALESCE($1,encrypted_access_token),
          encrypted_refresh_token=COALESCE($2,encrypted_refresh_token),
          token_expiry=COALESCE($3,token_expiry),
          updated_at=now()
         WHERE user_id=$4`,
        [
          tokens.access_token
            ? encryptSecret(tokens.access_token)
            : null,
          tokens.refresh_token
            ? encryptSecret(tokens.refresh_token)
            : null,
          tokens.expiry_date
            ? new Date(tokens.expiry_date)
            : null,
          userId
        ]
      );
    } catch (e) {
      console.error('[token-refresh-persist]', e.message);
    }
  });

  return client;
}

async function audit(userId, eventType, details = {}) {
  await query(
    'INSERT INTO audit_events(user_id,event_type,details) VALUES($1,$2,$3)',
    [
      userId,
      eventType,
      JSON.stringify(details)
    ]
  );
}


/*
 * ============================================================
 * ROUTER DE IMPORTAÇÃO ZIP
 * ============================================================
 */

router.use(createZipImportRouter({
  currentUser,
  requireCsrf,
  audit
}));


/*
 * ============================================================
 * ROUTER DE LOTES DE CORREÇÕES
 * ============================================================
 *
 * Não publica nada no Blogger.
 *
 * Ele apenas organiza:
 *
 * - lotes;
 * - artigos selecionados;
 * - histórico;
 * - propostas associadas.
 * ============================================================
 */

router.use(createCorrectionBatchesRouter({
  currentUser,
  requireCsrf
}));


function safeFileName(name, fallback = 'artigo') {
  let value = String(name || fallback)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();

  if (!value) {
    value = fallback;
  }

  if (value.length > 100) {
    value = value.slice(0, 100).replace(/-+$/, '');
  }

  return value;
}

function uniqueFileName(baseName, usedNames) {
  let name = `${baseName}.html`;
  let counter = 2;

  while (usedNames.has(name.toLowerCase())) {
    name = `${baseName}-${counter}.html`;
    counter++;
  }

  usedNames.add(name.toLowerCase());

  return name;
}


router.get('/auth/google', (req, res) => {
  const nonce = randomToken();

  res.cookie(
    'oauth_nonce',
    nonce,
    {
      ...cookieOptions,
      maxAge: 10 * 60 * 1000
    }
  );

  const c = oauthClient();

  res.redirect(
    c.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: [
        'openid',
        'email',
        'profile',
        BLOGGER_SCOPE
      ],
      state: nonce
    })
  );
});


router.get('/oauth/google/callback', async (req, res, next) => {
  try {
    const { code, state } = req.query;
    const expected = req.cookies?.oauth_nonce;

    res.clearCookie(
      'oauth_nonce',
      { path: '/' }
    );

    if (
      !expected ||
      !state ||
      !safeEqual(expected, state) ||
      typeof code !== 'string'
    ) {
      return res
        .status(400)
        .send('Autorização Google inválida. Tente conectar novamente.');
    }

    const c = oauthClient();
    const { tokens } = await c.getToken(code);

    c.setCredentials(tokens);

    const oauth2 = google.oauth2({
      version: 'v2',
      auth: c
    });

    const { data: profile } = await oauth2.userinfo.get();

    if (!profile.id || !profile.email) {
      return res
        .status(400)
        .send('Não foi possível identificar sua conta Google.');
    }

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const u = await client.query(
        `INSERT INTO app_users(google_sub,email,display_name)
         VALUES($1,$2,$3)
         ON CONFLICT(google_sub)
         DO UPDATE SET
           email=EXCLUDED.email,
           display_name=EXCLUDED.display_name
         RETURNING id`,
        [
          profile.id,
          profile.email,
          profile.name || ''
        ]
      );

      const uid = u.rows[0].id;

      const prior = await client.query(
        'SELECT encrypted_refresh_token FROM oauth_tokens WHERE user_id=$1',
        [uid]
      );

      const refresh =
        tokens.refresh_token
          ? encryptSecret(tokens.refresh_token)
          : prior.rows[0]?.encrypted_refresh_token;

      if (!refresh) {
        throw new Error(
          'Google não forneceu refresh token. Revogue o acesso antigo na conta Google e tente conectar novamente.'
        );
      }

      await client.query(
        `INSERT INTO oauth_tokens(
          user_id,
          encrypted_access_token,
          encrypted_refresh_token,
          token_expiry,
          scopes
        )
        VALUES($1,$2,$3,$4,$5)
        ON CONFLICT(user_id)
        DO UPDATE SET
          encrypted_access_token=
            COALESCE(
              EXCLUDED.encrypted_access_token,
              oauth_tokens.encrypted_access_token
            ),
          encrypted_refresh_token=
            EXCLUDED.encrypted_refresh_token,
          token_expiry=
            EXCLUDED.token_expiry,
          scopes=
            EXCLUDED.scopes,
          updated_at=now()`,
        [
          uid,
          tokens.access_token
            ? encryptSecret(tokens.access_token)
            : null,
          refresh,
          tokens.expiry_date
            ? new Date(tokens.expiry_date)
            : null,
          (tokens.scope || '')
            .split(' ')
            .filter(Boolean)
        ]
      );

      const sid = randomToken();
      const csrf = randomToken();

      await client.query(
        `INSERT INTO user_sessions(
          id_hash,
          user_id,
          csrf_hash,
          expires_at
        )
        VALUES(
          $1,
          $2,
          $3,
          now()+interval '14 days'
        )`,
        [
          sha256(sid),
          uid,
          sha256(csrf)
        ]
      );

      await client.query('COMMIT');

      res.cookie(
        'sid',
        sid,
        {
          ...cookieOptions,
          maxAge: SESSION_MS
        }
      );

      res.cookie(
        'csrf',
        csrf,
        {
          httpOnly: false,
          secure: cookieOptions.secure,
          sameSite: 'lax',
          path: '/',
          maxAge: SESSION_MS
        }
      );

      await audit(uid, 'google_connected');

      res.redirect('/');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (e) {
    next(e);
  }
});


router.get('/me', currentUser, (req, res) => {
  res.json({
    user: {
      id: req.user.id,
      email: req.user.email,
      display_name: req.user.display_name
    },
    csrf: req.cookies?.csrf || null
  });
});


router.post(
  '/auth/logout',
  currentUser,
  requireCsrf,
  async (req, res, next) => {
    try {
      await query(
        'DELETE FROM user_sessions WHERE id_hash=$1',
        [req.sessionHash]
      );

      res.clearCookie('sid', { path: '/' });
      res.clearCookie('csrf', { path: '/' });

      await audit(req.user.id, 'logout');

      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  }
);


router.get('/blogs', currentUser, async (req, res, next) => {
  try {
    const auth = await authForUser(req.user.id);
    const blogs = await listBlogs(auth);
    const saved = [];

    for (const b of blogs) {
      const r = await query(
        `INSERT INTO blogs(
          user_id,
          blogger_blog_id,
          name,
          url
        )
        VALUES($1,$2,$3,$4)
        ON CONFLICT(user_id,blogger_blog_id)
        DO UPDATE SET
          name=EXCLUDED.name,
          url=EXCLUDED.url
        RETURNING id,blogger_blog_id,name,url`,
        [
          req.user.id,
          b.blogger_blog_id,
          b.name,
          b.url
        ]
      );

      saved.push(r.rows[0]);
    }

    res.json({ blogs: saved });
  } catch (e) {
    next(e);
  }
});


/*
 * ============================================================
 * FEED COMPLETO PARA COMPARTILHAMENTO COM CHATGPT
 * ============================================================
 */

router.get(
  '/blogs/:blogId/share-feed',
  currentUser,
  async (req, res, next) => {
    try {
      const owned = await query(
        `SELECT blogger_blog_id, name, url
         FROM blogs
         WHERE id=$1 AND user_id=$2`,
        [
          req.params.blogId,
          req.user.id
        ]
      );

      if (!owned.rowCount) {
        return res.status(404).json({
          error: 'blog_not_found'
        });
      }

      const auth = await authForUser(req.user.id);
      const bloggerBlogId = owned.rows[0].blogger_blog_id;

      const [posts, pages] = await Promise.all([
        listPosts(auth, bloggerBlogId),
        listPages(auth, bloggerBlogId)
      ]);

      await audit(
        req.user.id,
        'feed_prepared_for_sharing',
        {
          blogId: req.params.blogId,
          articles: posts.length,
          pages: pages.length
        }
      );

      res.setHeader('Cache-Control', 'no-store');

      res.json({
        blog: {
          name: owned.rows[0].name,
          url: owned.rows[0].url
        },
        totalArticles: posts.length,
        totalPages: pages.length,
        items: [...posts, ...pages]
      });
    } catch (e) {
      next(e);
    }
  }
);


router.post(
  '/blogs/:blogId/sync',
  currentUser,
  requireCsrf,
  async (req, res, next) => {
    try {
      const owned = await query(
        `SELECT id,blogger_blog_id
         FROM blogs
         WHERE id=$1 AND user_id=$2`,
        [
          req.params.blogId,
          req.user.id
        ]
      );

      if (!owned.rowCount) {
        return res.status(404).json({
          error: 'blog_not_found'
        });
      }

      const auth = await authForUser(req.user.id);

      const posts = await listPosts(
        auth,
        owned.rows[0].blogger_blog_id
      );

      const client = await pool.connect();

      try {
        await client.query('BEGIN');

        for (const p of posts) {
          await client.query(
            `INSERT INTO posts(
              user_id,
              blog_id,
              blogger_post_id,
              title,
              url,
              content_html,
              content_text,
              labels,
              updated_at
            )
            VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)
            ON CONFLICT(
              user_id,
              blog_id,
              blogger_post_id
            )
            DO UPDATE SET
              title=EXCLUDED.title,
              url=EXCLUDED.url,
              content_html=EXCLUDED.content_html,
              content_text=EXCLUDED.content_text,
              labels=EXCLUDED.labels,
              updated_at=EXCLUDED.updated_at`,
            [
              req.user.id,
              owned.rows[0].id,
              p.blogger_post_id,
              p.title,
              p.url,
              p.content_html,
              stripHtml(p.content_html),
              p.labels,
              p.updated_at
            ]
          );
        }

        await client.query(
          `UPDATE blogs
           SET synced_at=now()
           WHERE id=$1 AND user_id=$2`,
          [
            owned.rows[0].id,
            req.user.id
          ]
        );

        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }

      await audit(req.user.id, 'blog_synced', {
        blogId: owned.rows[0].id,
        posts: posts.length
      });

      res.json({
        synced: posts.length
      });
    } catch (e) {
      next(e);
    }
  }
);


router.post(
  '/blogs/:blogId/analyze',
  currentUser,
  requireCsrf,
  async (req, res, next) => {
    try {
      const r = await query(
        `SELECT
          p.id,
          p.title,
          p.url,
          p.content_html,
          p.content_text
         FROM posts p
         JOIN blogs b ON b.id=p.blog_id
         WHERE p.blog_id=$1
           AND p.user_id=$2
           AND b.user_id=$2`,
        [
          req.params.blogId,
          req.user.id
        ]
      );

      if (!r.rowCount) {
        const exists = await query(
          `SELECT 1
           FROM blogs
           WHERE id=$1 AND user_id=$2`,
          [
            req.params.blogId,
            req.user.id
          ]
        );

        if (!exists.rowCount) {
          return res.status(404).json({
            error: 'blog_not_found'
          });
        }
      }

      const findings = analyzePosts(r.rows);

      const problemsByPost = new Map(
        r.rows.map(p => [String(p.id), []])
      );

      for (const f of findings) {
        for (const p of f.posts || []) {
          const target =
            problemsByPost.get(String(p.id));

          if (target) {
            target.push({
              type: 'possivel_conflito',
              risk: f.risk,
              score: f.score,
              relatedArticle:
                (f.posts || []).filter(
                  x => String(x.id) !== String(p.id)
                )[0] || null,
              sharedTerms: f.shared_terms || [],
              recommendation: f.recommendation
            });
          }
        }
      }

      const articles = r.rows.map(p => ({
        id: p.id,
        title: p.title,
        url: p.url,
        content_html: p.content_html || '',
        problems:
          problemsByPost.get(String(p.id)) || []
      }));

      await query(
        `INSERT INTO analysis_runs(
          user_id,
          blog_id,
          result
        )
        VALUES($1,$2,$3)`,
        [
          req.user.id,
          req.params.blogId,
          JSON.stringify({
            findings,
            articles
          })
        ]
      );

      await audit(req.user.id, 'analysis_run', {
        blogId: req.params.blogId,
        findings: findings.length
      });

      res.json({
        posts: r.rowCount,
        findings,
        articles,
        note:
          'Similaridade textual é um indício, não prova de canibalização. Valide intenção de busca e dados do Search Console.'
      });
    } catch (e) {
      next(e);
    }
  }
);


/*
 * ============================================================
 * DOWNLOAD DE TODOS OS ARTIGOS
 * ============================================================
 */

router.get(
  '/blogs/:blogId/download-all',
  currentUser,
  async (req, res, next) => {
    try {
      const blogResult = await query(
        `SELECT
          id,
          blogger_blog_id,
          name,
          url
         FROM blogs
         WHERE id=$1 AND user_id=$2`,
        [
          req.params.blogId,
          req.user.id
        ]
      );

      if (!blogResult.rowCount) {
        return res.status(404).json({
          error: 'blog_not_found'
        });
      }

      const blog = blogResult.rows[0];

      const postsResult = await query(
        `SELECT
          id,
          blogger_post_id,
          title,
          url,
          content_html,
          updated_at
         FROM posts
         WHERE blog_id=$1
           AND user_id=$2
         ORDER BY id ASC`,
        [
          blog.id,
          req.user.id
        ]
      );

      if (!postsResult.rowCount) {
        return res.status(404).json({
          error: 'no_posts',
          message:
            'Nenhum artigo sincronizado foi encontrado. Sincronize o blog antes de baixar.'
        });
      }

      const safeBlogName =
        safeFileName(blog.name, 'blogger');

      const zipFileName =
        `blogger-seo-${safeBlogName}-artigos.zip`;

      res.status(200);

      res.setHeader(
        'Content-Type',
        'application/zip'
      );

      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${zipFileName}"`
      );

      res.setHeader(
        'Cache-Control',
        'no-store'
      );

      const archive = archiver('zip', {
        zlib: {
          level: 9
        }
      });

      archive.on('error', error => {
        console.error(
          '[zip-error]',
          error
        );

        if (!res.headersSent) {
          next(error);
        } else {
          res.destroy(error);
        }
      });

      archive.pipe(res);

      const usedNames = new Set();

      const manifest = {
        version: 1,
        generatedAt:
          new Date().toISOString(),

        blog: {
          id: blog.id,
          bloggerBlogId:
            blog.blogger_blog_id,
          name: blog.name,
          url: blog.url
        },

        totalArticles:
          postsResult.rowCount,

        articles: []
      };

      for (const post of postsResult.rows) {
        const baseName =
          safeFileName(
            post.title,
            `artigo-${post.id}`
          );

        const fileName =
          uniqueFileName(
            baseName,
            usedNames
          );

        const html =
          typeof post.content_html === 'string'
            ? post.content_html
            : '';

        archive.append(
          html,
          {
            name: `artigos/${fileName}`
          }
        );

        manifest.articles.push({
          databaseId: post.id,
          bloggerPostId:
            post.blogger_post_id,
          title: post.title,
          url: post.url,
          file:
            `artigos/${fileName}`,
          updatedAt:
            post.updated_at
        });
      }

      archive.append(
        JSON.stringify(
          manifest,
          null,
          2
        ),
        {
          name: 'manifest.json'
        }
      );

      await archive.finalize();

      await audit(
        req.user.id,
        'articles_downloaded_zip',
        {
          blogId: blog.id,
          posts:
            postsResult.rowCount
        }
      );
    } catch (e) {
      next(e);
    }
  }
);


/*
 * ============================================================
 * CRIAÇÃO DE PROPOSTA INDIVIDUAL
 * ============================================================
 */

router.post(
  '/posts/:postId/proposals',
  currentUser,
  requireCsrf,
  async (req, res, next) => {
    try {
      const { html } = req.body || {};

      if (
        typeof html !== 'string' ||
        !html.trim() ||
        html.length > 1000000
      ) {
        return res.status(400).json({
          error: 'invalid_html'
        });
      }

      const r = await query(
        `SELECT
          id,
          content_html
         FROM posts
         WHERE id=$1
           AND user_id=$2`,
        [
          req.params.postId,
          req.user.id
        ]
      );

      if (!r.rowCount) {
        return res.status(404).json({
          error: 'post_not_found'
        });
      }

      const previousHtml =
        r.rows[0].content_html || '';

      const changeCount =
        countChangedSections(
          previousHtml,
          html
        );

      if (changeCount === 0) {
        return res.status(400).json({
          error: 'no_changes_detected',
          message: 'A proposta é idêntica ao HTML original.'
        });
      }

      const b = await query(
        `INSERT INTO post_backups(
          user_id,
          post_id,
          previous_html,
          proposed_html,
          change_count
        )
        VALUES($1,$2,$3,$4,$5)
        RETURNING
          id,
          status,
          created_at,
          change_count`,
        [
          req.user.id,
          r.rows[0].id,
          previousHtml,
          html,
          changeCount
        ]
      );

      await audit(
        req.user.id,
        'proposal_created',
        {
          proposalId:
            b.rows[0].id,
          postId:
            r.rows[0].id,
          changeCount
        }
      );

      res.status(201).json({
        proposal:
          b.rows[0],

        message:
          'Proposta salva. Nenhuma alteração foi enviada ao Blogger.'
      });
    } catch (e) {
      next(e);
    }
  }
);


/*
 * ============================================================
 * RECÁLCULO DAS CONTAGENS
 * ============================================================
 */

router.post(
  '/proposals/recalculate-counts',
  currentUser,
  requireCsrf,
  async (req, res, next) => {
    const client =
      await pool.connect();

    try {
      await client.query(
        'BEGIN'
      );

      const proposalsResult =
        await client.query(
          `SELECT
            id,
            previous_html,
            proposed_html
           FROM post_backups
           WHERE user_id=$1
           ORDER BY id ASC
           LIMIT 500
           FOR UPDATE`,
          [
            req.user.id
          ]
        );

      let updated = 0;

      for (
        const proposal
        of proposalsResult.rows
      ) {
        const changeCount =
          countChangedSections(
            proposal.previous_html || '',
            proposal.proposed_html || ''
          );

        await client.query(
          `UPDATE post_backups
           SET change_count=$1
           WHERE id=$2
             AND user_id=$3`,
          [
            changeCount,
            proposal.id,
            req.user.id
          ]
        );

        updated++;
      }

      await client.query(
        'COMMIT'
      );

      await audit(
        req.user.id,
        'proposal_counts_recalculated',
        {
          updated
        }
      );

      res.json({
        ok: true,
        updated,

        message:
          `${updated} propostas tiveram suas contagens recalculadas. Nenhum artigo foi publicado.`
      });

    } catch (e) {
      try {
        await client.query(
          'ROLLBACK'
        );
      } catch {}

      next(e);

    } finally {
      client.release();
    }
  }
);


router.get(
  '/proposals',
  currentUser,
  async (req, res, next) => {
    try {
      const r = await query(
        `SELECT
          pb.id,
          pb.post_id,
          pb.status,
          pb.change_count,
          pb.created_at,
          pb.applied_at,
          pb.reconciliation_action,
          pb.reconciliation_reason,
          p.title,
          p.url
         FROM post_backups pb
         JOIN posts p
           ON p.id=pb.post_id
         WHERE pb.user_id=$1
           AND p.user_id=$1
         ORDER BY pb.id DESC
         LIMIT 100`,
        [
          req.user.id
        ]
      );

      res.json({
        proposals:
          r.rows
      });

    } catch (e) {
      next(e);
    }
  }
);


/*
 * Proposal lifecycle: all external writes are claimed atomically first.
 */
async function updateLinkedBatchStatus(db, proposalId, status) {
  const linked = await db.query(
    'UPDATE correction_batch_items SET status=$1, updated_at=now() WHERE proposal_id=$2 RETURNING batch_id',
    [status, proposalId]
  );
  for (const batchId of [...new Set(linked.rows.map(row => String(row.batch_id)))]) {
    await db.query(
      "UPDATE correction_batches cb SET total_items=(SELECT COUNT(*) FROM correction_batch_items WHERE batch_id=$1), pending_items=(SELECT COUNT(*) FROM correction_batch_items WHERE batch_id=$1 AND status='pending'), approved_items=(SELECT COUNT(*) FROM correction_batch_items WHERE batch_id=$1 AND status='approved'), published_items=(SELECT COUNT(*) FROM correction_batch_items WHERE batch_id=$1 AND status='published'), rejected_items=(SELECT COUNT(*) FROM correction_batch_items WHERE batch_id=$1 AND status='rejected'), updated_at=now() WHERE cb.id=$1",
      [batchId]
    );
  }
}

async function markProposalReconciliation(proposalId, userId, action, reason) {
  await query(
    "UPDATE post_backups SET status='reconciliation_required', reconciliation_action=$1, reconciliation_reason=$2 WHERE id=$3 AND user_id=$4 AND status IN ('applying','restoring','reconciling')",
    [action, String(reason || 'remote_result_uncertain').slice(0, 500), proposalId, userId]
  );
}

router.get('/proposals/:id', currentUser, async (req, res, next) => {
  try {
    const result = await query(
      'SELECT pb.id,pb.user_id,pb.post_id,pb.previous_html,pb.proposed_html,pb.change_count,pb.status,pb.created_at,pb.applied_at,pb.restored_at,pb.reconciliation_action,pb.reconciliation_reason,p.title,p.url,p.blogger_post_id,p.updated_at AS local_updated_at,b.blogger_blog_id FROM post_backups pb JOIN posts p ON p.id=pb.post_id JOIN blogs b ON b.id=p.blog_id WHERE pb.id=$1 AND pb.user_id=$2 AND p.user_id=$2 AND b.user_id=$2',
      [req.params.id, req.user.id]
    );
    if (!result.rowCount) return res.status(404).json({ error: 'proposal_not_found' });
    res.setHeader('Cache-Control', 'no-store');
    res.json({ proposal: result.rows[0] });
  } catch (error) { next(error); }
});

router.post('/proposals/:id/reject', currentUser, requireCsrf, async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      "UPDATE post_backups SET status='rejected', reconciliation_action=NULL, reconciliation_reason=NULL WHERE id=$1 AND user_id=$2 AND status='pending' RETURNING id",
      [req.params.id, req.user.id]
    );
    if (!result.rowCount) {
      const exists = await client.query('SELECT 1 FROM post_backups WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
      await client.query('ROLLBACK');
      return res.status(exists.rowCount ? 409 : 404).json({ error: exists.rowCount ? 'proposal_not_pending' : 'proposal_not_found' });
    }
    await updateLinkedBatchStatus(client, req.params.id, 'rejected');
    await client.query('COMMIT');
    await audit(req.user.id, 'proposal_rejected', { proposalId: req.params.id }).catch(error => console.error('[audit-proposal-rejected]', error.message));
    res.json({ ok: true, proposalId: req.params.id });
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch {}
    next(error);
  } finally { client.release(); }
});

router.post('/proposals/:id/approve', currentUser, requireCsrf, async (req, res, next) => {
  const client = await pool.connect();
  let row;
  let writeStarted = false;
  try {
    await client.query('BEGIN');
    const selected = await client.query(
      'SELECT pb.*,p.blogger_post_id,p.updated_at AS local_updated_at,b.blogger_blog_id FROM post_backups pb JOIN posts p ON p.id=pb.post_id JOIN blogs b ON b.id=p.blog_id WHERE pb.id=$1 AND pb.user_id=$2 AND p.user_id=$2 AND b.user_id=$2 FOR UPDATE OF pb',
      [req.params.id, req.user.id]
    );
    if (!selected.rowCount) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'proposal_not_found' });
    }
    row = selected.rows[0];
    if (row.status !== 'pending') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'proposal_not_pending', status: row.status });
    }
    const claimed = await client.query(
      "UPDATE post_backups SET status='applying', reconciliation_action='apply', reconciliation_reason=NULL WHERE id=$1 AND user_id=$2 AND status='pending' RETURNING id",
      [row.id, req.user.id]
    );
    if (!claimed.rowCount) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'proposal_not_pending' });
    }
    await client.query('COMMIT');

    const auth = await authForUser(req.user.id);
    const live = await getPost(auth, row.blogger_blog_id, row.blogger_post_id);
    const localTime = row.local_updated_at ? new Date(row.local_updated_at).getTime() : NaN;
    const remoteTime = live.updated ? new Date(live.updated).getTime() : NaN;
    if (!Number.isFinite(localTime) || !Number.isFinite(remoteTime) || localTime !== remoteTime) {
      await markProposalReconciliation(row.id, req.user.id, 'apply', 'blogger_post_changed_before_apply');
      return res.status(409).json({
        error: 'blogger_post_changed',
        status: 'reconciliation_required',
        message: 'A versão remota não corresponde exatamente à última sincronização local. Revise e reconcilie antes de tentar novamente.'
      });
    }

    writeStarted = true;
    const remoteAfterApply = await updatePost(auth, row.blogger_blog_id, row.blogger_post_id, row.proposed_html, {
      updated: row.local_updated_at,
      content: row.previous_html
    });

    await client.query('BEGIN');
    const finalized = await client.query(
      "UPDATE post_backups SET status='applied', applied_at=now(), reconciliation_action=NULL, reconciliation_reason=NULL WHERE id=$1 AND user_id=$2 AND status='applying' RETURNING id",
      [row.id, req.user.id]
    );
    if (!finalized.rowCount) throw new Error('proposal_state_changed_after_remote_write');
    await client.query('UPDATE posts SET content_html=$1, content_text=$2, updated_at=COALESCE($3,updated_at) WHERE id=$4 AND user_id=$5',
      [row.proposed_html, stripHtml(row.proposed_html), remoteAfterApply.data?.updated || null, row.post_id, req.user.id]);
    await updateLinkedBatchStatus(client, row.id, 'published');
    await client.query('COMMIT');
    await audit(req.user.id, 'proposal_applied', { proposalId: row.id, postId: row.post_id }).catch(error => console.error('[audit-proposal-applied]', error.message));
    res.json({ ok: true, backupId: row.id, status: 'applied' });
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch {}
    if (row?.id) {
      try {
        if (writeStarted) {
          await markProposalReconciliation(row.id, req.user.id, 'apply', 'apply_result_uncertain');
        } else {
          await query("UPDATE post_backups SET status='pending', reconciliation_action=NULL, reconciliation_reason=NULL WHERE id=$1 AND user_id=$2 AND status='applying'", [row.id, req.user.id]);
        }
      } catch (stateError) { console.error('[proposal-state-recovery]', stateError.message); }
    }
    next(error);
  } finally { client.release(); }
});

router.post('/proposals/:id/restore', currentUser, requireCsrf, async (req, res, next) => {
  const client = await pool.connect();
  let row;
  let writeStarted = false;
  try {
    await client.query('BEGIN');
    const selected = await client.query(
      'SELECT pb.*,p.blogger_post_id,b.blogger_blog_id FROM post_backups pb JOIN posts p ON p.id=pb.post_id JOIN blogs b ON b.id=p.blog_id WHERE pb.id=$1 AND pb.user_id=$2 AND p.user_id=$2 AND b.user_id=$2 FOR UPDATE OF pb',
      [req.params.id, req.user.id]
    );
    if (!selected.rowCount) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'backup_not_found' });
    }
    row = selected.rows[0];
    if (row.status !== 'applied') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'backup_not_applied', status: row.status });
    }
    const claimed = await client.query(
      "UPDATE post_backups SET status='restoring', reconciliation_action='restore', reconciliation_reason=NULL WHERE id=$1 AND user_id=$2 AND status='applied' RETURNING id",
      [row.id, req.user.id]
    );
    if (!claimed.rowCount) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'backup_not_applied' });
    }
    await client.query('COMMIT');

    const auth = await authForUser(req.user.id);
    writeStarted = true;
    const remoteAfterRestore = await updatePost(auth, row.blogger_blog_id, row.blogger_post_id, row.previous_html, {
      content: row.proposed_html
    });

    await client.query('BEGIN');
    const finalized = await client.query(
      "UPDATE post_backups SET status='restored', restored_at=now(), reconciliation_action=NULL, reconciliation_reason=NULL WHERE id=$1 AND user_id=$2 AND status='restoring' RETURNING id",
      [row.id, req.user.id]
    );
    if (!finalized.rowCount) throw new Error('restore_state_changed_after_remote_write');
    await client.query('UPDATE posts SET content_html=$1, content_text=$2, updated_at=COALESCE($3,updated_at) WHERE id=$4 AND user_id=$5',
      [row.previous_html, stripHtml(row.previous_html), remoteAfterRestore.data?.updated || null, row.post_id, req.user.id]);
    await updateLinkedBatchStatus(client, row.id, 'pending');
    await client.query('COMMIT');
    await audit(req.user.id, 'proposal_restored', { proposalId: row.id, postId: row.post_id }).catch(error => console.error('[audit-proposal-restored]', error.message));
    res.json({ ok: true, restoredBackupId: row.id, status: 'restored' });
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch {}
    if (row?.id) {
      try {
        if (writeStarted) {
          await markProposalReconciliation(row.id, req.user.id, 'restore', 'restore_result_uncertain');
        } else {
          await query("UPDATE post_backups SET status='applied', reconciliation_action=NULL, reconciliation_reason=NULL WHERE id=$1 AND user_id=$2 AND status='restoring'", [row.id, req.user.id]);
        }
      } catch (stateError) { console.error('[restore-state-recovery]', stateError.message); }
    }
    next(error);
  } finally { client.release(); }
});

router.post('/proposals/:id/reconcile', currentUser, requireCsrf, async (req, res, next) => {
  const client = await pool.connect();
  let row;
  try {
    await client.query('BEGIN');
    const selected = await client.query(
      'SELECT pb.*,p.blogger_post_id,b.blogger_blog_id FROM post_backups pb JOIN posts p ON p.id=pb.post_id JOIN blogs b ON b.id=p.blog_id WHERE pb.id=$1 AND pb.user_id=$2 AND p.user_id=$2 AND b.user_id=$2 FOR UPDATE OF pb',
      [req.params.id, req.user.id]
    );
    if (!selected.rowCount) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'proposal_not_found' });
    }
    row = selected.rows[0];
    if (row.status !== 'reconciliation_required') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'reconciliation_not_required', status: row.status });
    }
    await client.query("UPDATE post_backups SET status='reconciling' WHERE id=$1 AND user_id=$2", [row.id, req.user.id]);
    await client.query('COMMIT');

    const auth = await authForUser(req.user.id);
    const live = await getPost(auth, row.blogger_blog_id, row.blogger_post_id);
    const remoteHtml = String(live.content || '');
    let finalStatus = null;
    let finalHtml = null;
    if (row.reconciliation_action === 'apply') {
      if (remoteHtml === row.proposed_html) { finalStatus = 'applied'; finalHtml = row.proposed_html; }
      else if (remoteHtml === row.previous_html) { finalStatus = 'pending'; finalHtml = row.previous_html; }
    } else if (row.reconciliation_action === 'restore') {
      if (remoteHtml === row.previous_html) { finalStatus = 'restored'; finalHtml = row.previous_html; }
      else if (remoteHtml === row.proposed_html) { finalStatus = 'applied'; finalHtml = row.proposed_html; }
    }
    if (!finalStatus) {
      await query("UPDATE post_backups SET status='reconciliation_required', reconciliation_reason='remote_content_diverged' WHERE id=$1 AND user_id=$2 AND status='reconciling'", [row.id, req.user.id]);
      return res.status(409).json({
        error: 'remote_content_diverged',
        status: 'reconciliation_required',
        message: 'O HTML remoto não corresponde exatamente ao original nem à proposta. Nenhuma alteração foi feita; é necessária revisão manual.'
      });
    }

    await client.query('BEGIN');
    await client.query(
      "UPDATE post_backups SET status=$1, applied_at=CASE WHEN $1='applied' THEN COALESCE(applied_at,now()) ELSE applied_at END, restored_at=CASE WHEN $1='restored' THEN now() ELSE restored_at END, reconciliation_action=NULL, reconciliation_reason=NULL WHERE id=$2 AND user_id=$3 AND status='reconciling'",
      [finalStatus, row.id, req.user.id]
    );
    await client.query('UPDATE posts SET content_html=$1, content_text=$2, updated_at=COALESCE($3,updated_at) WHERE id=$4 AND user_id=$5',
      [finalHtml, stripHtml(finalHtml), live.updated || null, row.post_id, req.user.id]);
    await updateLinkedBatchStatus(client, row.id, finalStatus === 'applied' ? 'published' : 'pending');
    await client.query('COMMIT');
    await audit(req.user.id, 'proposal_reconciled', { proposalId: row.id, status: finalStatus }).catch(error => console.error('[audit-proposal-reconciled]', error.message));
    res.json({ ok: true, status: finalStatus, message: 'Estado confirmado pela comparação exata do HTML no Blogger.' });
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch {}
    if (row?.id) {
      await query("UPDATE post_backups SET status='reconciliation_required' WHERE id=$1 AND user_id=$2 AND status='reconciling'", [row.id, req.user.id]).catch(() => {});
    }
    next(error);
  } finally { client.release(); }
});
