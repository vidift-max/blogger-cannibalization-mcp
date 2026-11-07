import express from 'express';
import cookieParser from 'cookie-parser';
import { migrate, pool } from './db.js';
import { router } from './routes.js';

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  next();
});
const buckets = new Map();
app.use('/api', (req, res, next) => {
  const key = `${req.ip}:${Math.floor(Date.now() / 60000)}`;
  const count = (buckets.get(key) || 0) + 1;
  buckets.set(key, count);
  if (buckets.size > 5000) buckets.clear();
  if (count > 120) return res.status(429).json({ error: 'rate_limit_exceeded' });
  next();
});
app.use(express.static('public'));
app.get('/healthz', async (_req, res) => {
  try { await pool.query('SELECT 1'); res.json({ ok: true }); }
  catch { res.status(503).json({ ok: false }); }
});
app.use('/api', router);
app.use((err, _req, res, _next) => {
  console.error('[request]', err.message);
  res.status(500).json({ error: 'internal_error', message: 'Ocorreu um erro interno. Consulte os logs do serviço.' });
});
const port = Number(process.env.PORT || 3000);
await migrate();
app.listen(port, '0.0.0.0', () => console.log(`Blogger Cannibalization AI listening on ${port}`));
const shutdown = async () => { await pool.end(); process.exit(0); };
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
