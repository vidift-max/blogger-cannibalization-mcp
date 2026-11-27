
import { google } from 'googleapis';

export const BLOGGER_SCOPE = 'https://www.googleapis.com/auth/blogger';

export function oauthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

export async function listBlogs(auth) {
  const api = google.blogger({ version: 'v3', auth });

  const r = await api.blogs.listByUser({
    userId: 'self'
  });

  return (r.data.items || []).map(b => ({
    blogger_blog_id: String(b.id),
    name: b.name || 'Blog sem nome',
    url: b.url || ''
  }));
}

/*
 * LISTAR TODOS OS ARTIGOS
 */
export async function listPosts(auth, blogId) {
  const api = google.blogger({ version: 'v3', auth });

  let pageToken;
  const all = [];
  let pages = 0;

  do {
    const r = await api.posts.list({
      blogId,
      fetchBodies: true,
      maxResults: 500,
      pageToken
    });

    for (const p of r.data.items || []) {
      all.push({
        type: 'article',
        blogger_post_id: String(p.id),
        title: p.title || '',
        url: p.url || '',
        content_html: p.content || '',
        updated_at: p.updated || null,
        labels: p.labels || []
      });
    }

    pageToken = r.data.nextPageToken;
    pages++;
  } while (pageToken && pages < 100);

  if (pageToken) {
    throw new Error(
      'Limite de paginação dos artigos atingido.'
    );
  }

  return all;
}

/*
 * LISTAR TODAS AS PÁGINAS
 */
export async function listPages(auth, blogId) {
  const api = google.blogger({ version: 'v3', auth });

  let pageToken;
  const all = [];
  let pages = 0;

  do {
    const r = await api.pages.list({
      blogId,
      fetchBodies: true,
      maxResults: 500,
      pageToken
    });

    for (const p of r.data.items || []) {
      all.push({
        type: 'page',
        blogger_page_id: String(p.id),
        title: p.title || '',
        url: p.url || '',
        content_html: p.content || '',
        updated_at: p.updated || null
      });
    }

    pageToken = r.data.nextPageToken;
    pages++;
  } while (pageToken && pages < 100);

  if (pageToken) {
    throw new Error(
      'Limite de paginação das páginas atingido.'
    );
  }

  return all;
}

export async function getPost(auth, blogId, postId) {
  const api = google.blogger({ version: 'v3', auth });

  return (
    await api.posts.get({
      blogId,
      postId
    })
  ).data;
}

export async function updatePost(auth, blogId, postId, html, expected = {}) {
  const api = google.blogger({ version: 'v3', auth });

  const existing = await api.posts.get({
    blogId,
    postId
  });
  const current = existing.data;

  if (expected.content !== undefined && String(current.content || '') !== expected.content) {
    const error = new Error('O HTML do artigo mudou no Blogger desde a revisão.');
    error.code = 'BLOGGER_POST_CHANGED';
    throw error;
  }

  if (expected.updated !== undefined) {
    const currentTime = current.updated ? new Date(current.updated).getTime() : NaN;
    const expectedTime = expected.updated ? new Date(expected.updated).getTime() : NaN;
    if (!Number.isFinite(currentTime) || !Number.isFinite(expectedTime) || currentTime !== expectedTime) {
      const error = new Error('A versão do artigo mudou no Blogger desde a sincronização.');
      error.code = 'BLOGGER_POST_CHANGED';
      throw error;
    }
  }

  if (!current.etag) {
    const error = new Error('O Blogger não forneceu ETag; atualização condicional recusada.');
    error.code = 'BLOGGER_ETAG_MISSING';
    throw error;
  }

  return api.posts.update({
    blogId,
    postId,
    requestBody: {
      ...current,
      content: html
    }
  }, {
    headers: {
      'If-Match': current.etag
    }
  });
}
