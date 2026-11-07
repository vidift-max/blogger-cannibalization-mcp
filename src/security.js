import crypto from 'node:crypto';

const key = () => {
  const raw = process.env.TOKEN_ENCRYPTION_KEY || '';
  if (!/^[a-f0-9]{64}$/i.test(raw)) throw new Error('TOKEN_ENCRYPTION_KEY deve conter 64 caracteres hexadecimais.');
  return Buffer.from(raw, 'hex');
};
export function encryptSecret(value) {
  if (!value) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map(b => b.toString('base64url')).join('.');
}
export function decryptSecret(value) {
  if (!value) return null;
  const parts = value.split('.');
  if (parts.length !== 3) throw new Error('Token criptografado inválido.');
  const [iv, tag, data] = parts.map(v => Buffer.from(v, 'base64url'));
  const decipher = crypto.createDecipheriv('aes-256-gcm', key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}
export const randomToken = () => crypto.randomBytes(32).toString('base64url');
export const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
export function safeEqual(a, b) {
  const aa = Buffer.from(String(a)); const bb = Buffer.from(String(b));
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}
export function stripHtml(html='') {
  return String(html).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&').replace(/\s+/g, ' ').trim();
}
