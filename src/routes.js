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
 * ============================================================
 * APROVAÇÃO MANUAL DE PROPOSTA
 * ============================================================
 *
 * IMPORTANTE:
 * Esta é a única parte que efetivamente envia uma alteração
 * ao Blogger.
 *
 * Continua exigindo:
 * - usuário autenticado;
 * - CSRF;
 * - proposta pendente;
 * - confirmação explícita através da ação de aprovação.
 * ============================================================
 */

router.post(
  '/proposals/:id/approve',
  currentUser,
  requireCsrf,
  async (req, res, next) => {
    const client =
      await pool.connect();

    let row;

    try {
      await client.query(
        'BEGIN'
      );

      const p =
        await client.query(
          `SELECT
            pb.*,
            p.blogger_post_id,
            p.updated_at AS local_updated_at,
            b.blogger_blog_id
           FROM post_backups pb
           JOIN posts p
             ON p.id=pb.post_id
           JOIN blogs b
             ON b.id=p.blog_id
           WHERE pb.id=$1
             AND pb.user_id=$2
             AND p.user_id=$2
             AND b.user_id=$2
           FOR UPDATE`,
          [
            req.params.id,
            req.user.id
          ]
        );

      if (!p.rowCount) {
        await client.query(
          'ROLLBACK'
        );

        return res.status(404).json({
          error:
            'proposal_not_found'
        });
      }

      row =
        p.rows[0];

      if (
        row.status !== 'pending'
      ) {
        await client.query(
          'ROLLBACK'
        );

        return res.status(409).json({
          error:
            'proposal_not_pending'
        });
      }

      await client.query(
        `UPDATE post_backups
         SET status=$1
         WHERE id=$2
           AND user_id=$3`,
        [
          'pending',
          row.id,
          req.user.id
        ]
      );

      await client.query(
        'COMMIT'
      );

      const auth =
        await authForUser(
          req.user.id
        );

      const live =
        await getPost(
          auth,
          row.blogger_blog_id,
          row.blogger_post_id
        );

      if (
        row.local_updated_at &&
        live.updated &&
        new Date(live.updated) >
          new Date(row.local_updated_at)
      ) {
        return res.status(409).json({
          error:
            'blogger_post_changed',

          message:
            'O artigo mudou no Blogger desde a última sincronização. Sincronize novamente antes de aprovar.'
        });
      }

      await updatePost(
        auth,
        row.blogger_blog_id,
        row.blogger_post_id,
        row.proposed_html
      );

      await query(
        `UPDATE post_backups
         SET status='applied',
             applied_at=now()
         WHERE id=$1
           AND user_id=$2
           AND status='pending'`,
        [
          row.id,
          req.user.id
        ]
      );

      await query(
        `UPDATE posts
         SET content_html=$1,
             content_text=$2
         WHERE id=$3
           AND user_id=$4`,
        [
          row.proposed_html,
          stripHtml(
            row.proposed_html
          ),
          row.post_id,
          req.user.id
        ]
      );

      await audit(
        req.user.id,
        'proposal_applied',
        {
          proposalId:
            row.id,
          postId:
            row.post_id
        }
      );

      res.json({
        ok: true,
        backupId:
          row.id
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


/*
 * ============================================================
 * RESTAURAÇÃO DE BACKUP
 * ============================================================
 */

router.post(
  '/proposals/:id/restore',
  currentUser,
  requireCsrf,
  async (req, res, next) => {
    try {
      const r = await query(
        `SELECT
          pb.*,
          p.blogger_post_id,
          b.blogger_blog_id
         FROM post_backups pb
         JOIN posts p
           ON p.id=pb.post_id
         JOIN blogs b
           ON b.id=p.blog_id
         WHERE pb.id=$1
           AND pb.user_id=$2
           AND p.user_id=$2
           AND b.user_id=$2`,
        [
          req.params.id,
          req.user.id
        ]
      );

      if (!r.rowCount) {
        return res.status(404).json({
          error:
            'backup_not_found'
        });
      }

      const row =
        r.rows[0];

      if (
        row.status !== 'applied'
      ) {
        return res.status(409).json({
          error:
            'backup_not_applied'
        });
      }

      const auth =
        await authForUser(
          req.user.id
        );

      await updatePost(
        auth,
        row.blogger_blog_id,
        row.blogger_post_id,
        row.previous_html
      );

      await query(
        `UPDATE post_backups
         SET status='restored',
             restored_at=now()
         WHERE id=$1
           AND user_id=$2
           AND status='applied'`,
        [
          row.id,
          req.user.id
        ]
      );

      await query(
        `UPDATE posts
         SET content_html=$1,
             content_text=$2
         WHERE id=$3
           AND user_id=$4`,
        [
          row.previous_html,
          stripHtml(
            row.previous_html
          ),
          row.post_id,
          req.user.id
        ]
      );

      await audit(
        req.user.id,
        'proposal_restored',
        {
          proposalId:
            row.id,
          postId:
            row.post_id
        }
      );

      res.json({
        ok: true,
        restoredBackupId:
          row.id
      });

    } catch (e) {
      next(e);
    }
  }
);
