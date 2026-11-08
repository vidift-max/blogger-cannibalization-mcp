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
  const r = await api.blogs.listByUser({ userId: 'self' });
  return (r.data.items || []).map(b => ({
    blogger_blog_id: String(b.id), name: b.name || 'Blog sem nome', url: b.url || ''
  }));
}
export async function listPosts(auth, blogId) {
  const api = google.blogger({ version: 'v3', auth });
  let pageToken;
  const all = [];
  let pages = 0;
  do {
    const r = await api.posts.list({ blogId, fetchBodies: true, maxResults: 500, pageToken });
    for (const p of r.data.items || []) all.push({
      blogger_post_id: String(p.id), title: p.title || '', url: p.url || '',
      content_html: p.content || '', updated_at: p.updated || null, labels: p.labels || []
    });
    pageToken = r.data.nextPageToken;
    pages++;
  } while (pageToken && pages < 100);
  if (pageToken) throw new Error('Limite de paginação atingido; sincronização interrompida por segurança.');
  return all;
}
export async function getPost(auth, blogId, postId) {
  const api = google.blogger({ version: 'v3', auth });
  return (await api.posts.get({ blogId, postId })).data;
}
export async function updatePost(auth, blogId, postId, html) {
  const api = google.blogger({ version: 'v3', auth });
  const existing = await api.posts.get({ blogId, postId });
  return api.posts.update({
    blogId, postId,
    requestBody: { ...existing.data, content: html }
  });
}
