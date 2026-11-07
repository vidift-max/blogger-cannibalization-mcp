import { google } from 'googleapis';
export const BLOGGER_SCOPE='https://www.googleapis.com/auth/blogger';
export function oauthClient() { return new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID,process.env.GOOGLE_CLIENT_SECRET,process.env.GOOGLE_REDIRECT_URI); }
export async function listBlogs(tokens) { const auth=oauthClient(); auth.setCredentials(tokens); const r=await google.blogger({version:'v3',auth}).blogs.listByUser({}); return r.data.items||[]; }
export async function listPosts(tokens, blogId) {
  const auth=oauthClient(); auth.setCredentials(tokens); const api=google.blogger({version:'v3',auth}); let pageToken; const all=[];
  do { const r=await api.posts.list({blogId,fetchBodies:true,maxResults:500,pageToken}); for(const p of r.data.items||[]) all.push({blogger_post_id:p.id,title:p.title||'',url:p.url||'',content_html:p.content||'',updated_at:p.updated,labels:p.labels||[]}); pageToken=r.data.nextPageToken; } while(pageToken);
  return all;
}
export async function updatePost(tokens, blogId, postId, html) { const auth=oauthClient(); auth.setCredentials(tokens); const api=google.blogger({version:'v3',auth}); const existing=await api.posts.get({blogId,postId}); return api.posts.update({blogId,postId,requestBody:{...existing.data,content:html}}); }
