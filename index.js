import http from 'node:http';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { config } from './config.js';
import { openStore } from './store.js';
import { makeSyncGuard, syncIndex } from './feed.js';
import { registerTools } from './tools.js';

mkdirSync(dirname(config.dbPath), { recursive: true });
const store = openStore();
const ensureFresh = makeSyncGuard(store);

// CORREÇÃO (bug #6): um McpServer POR REQUISIÇÃO — padrão recomendado para HTTP stateless
// pelo SDK da MCP. Garante que duas chamadas simultâneas de tool pelo ChatGPT não
// compartilhem o mesmo objeto de servidor/transporte.
function createServer() {
  const server = new McpServer(
    { name: 'stateside-money-blog', version: '1.0.0' },
    { capabilities: { tools: {} } }
  );
  registerTools(server, { store, ensureFresh });
  return server;
}

const checkAuth = (req) =>
  !config.authToken || (req.headers.authorization || '') === `Bearer ${config.authToken}`;

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : undefined;
}

const httpServer = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname === '/healthz') {
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ ok: true, lastSync: store.metaGet('last_sync'), articles: store.allArticles().length }));
    }
    if (url.pathname === '/') {
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ name: 'blogger-cannibalization-mcp', readOnly: true, mcpEndpoint: '/mcp', blog: config.blogUrl }));
    }
    if (url.pathname !== '/mcp') { res.writeHead(404); return res.end(); }
    if (!checkAuth(req)) {
      res.writeHead(401, { 'www-authenticate': 'Bearer' });
      return res.end(JSON.stringify({ error: 'unauthorized' }));
    }
    // Stateless: novo transporte por requisição, sem session id
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on('close', () => transport.close());
    await createServer().connect(transport);
    await transport.handleRequest(req, res, await readBody(req));
  } catch (err) {
    if (!res.headersSent) res.writeHead(500, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: String(err.message || err) }));
  }
});

httpServer.listen(config.port, '0.0.0.0', () => {
  console.log(`[mcp] ouvindo em http://localhost:${config.port} — blog: ${config.blogUrl}`);
  // Primeiro sync em background (não bloqueia o servidor). Keywords são indexadas
  // dentro do próprio syncIndex (correção do bug #8).
  syncIndex(store, { full: true })
    .then((r) => console.log(`[sync] completo: ${r.inserted + r.updated} novos/alterados, ${r.unchanged} íntegros, total no feed: ${r.total}. Servidor pronto.`))
    .catch((err) => console.error('[sync] falhou na inicialização:', err.message));
});