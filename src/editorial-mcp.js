import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import { buildEditorialBrief } from './editorial-brief.js';
import { query } from './db.js';
import { sha256, safeEqual } from './security.js';

function configured() {
  return Boolean(
    process.env.MCP_EDITORIAL_TOKEN &&
    process.env.MCP_EDITORIAL_BLOG_ID
  );
}

function authorized(req) {
  if (!configured()) return false;

  const header = String(req.headers.authorization || '');
  if (!header.startsWith('Bearer ')) return false;

  const presented = header.slice(7);
  return safeEqual(
    sha256(presented),
    sha256(process.env.MCP_EDITORIAL_TOKEN)
  );
}

async function loadCorpus(blogId) {
  const blog = await query(
    `SELECT id,name,url,synced_at
     FROM blogs
     WHERE id=$1`,
    [blogId]
  );

  if (!blog.rowCount) {
    const error = new Error('blog_not_found');
    error.code = 'BLOG_NOT_FOUND';
    throw error;
  }

  const [posts, pages] = await Promise.all([
    query(
      `SELECT id,title,url,content_text,labels
       FROM posts WHERE blog_id=$1`,
      [blogId]
    ),
    query(
      `SELECT id,title,url,content_text
       FROM pages WHERE blog_id=$1`,
      [blogId]
    )
  ]);

  return {
    blog: blog.rows[0],
    corpus: [
      ...posts.rows.map(row => ({
        ...row,
        document_type: 'article'
      })),
      ...pages.rows.map(row => ({
        ...row,
        document_type: 'page',
        labels: []
      }))
    ]
  };
}

function createServer() {
  const server = new McpServer(
    {
      name: 'blogger-seo-editorial-bridge',
      version: '1.0.0'
    },
    {
      capabilities: { tools: {} }
    }
  );

  server.registerTool(
    'get_editorial_brief',
    {
      title: 'Get Blogger editorial brief',
      description:
        'Read-only access to the latest synchronized Blogger corpus. Returns relevant existing articles/pages, evidence-based cannibalization findings, occupied topics, high-risk documents, and context for choosing a new news angle. It never publishes or changes Blogger.',
      inputSchema: {
        query: z.string().min(1).max(500),
        title: z.string().max(300).optional()
      }
    },
    async ({ query: queryText, title }) => {
      const { blog, corpus } = await loadCorpus(
        process.env.MCP_EDITORIAL_BLOG_ID
      );

      const brief = buildEditorialBrief({
        corpus,
        query: queryText,
        sourceTitle: title || '',
        limit: 12
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                blog: {
                  name: blog.name,
                  url: blog.url
                },
                synced_at: blog.synced_at,
                corpus_size: corpus.length,
                brief
              },
              null,
              2
            )
          }
        ]
      };
    }
  );

  return server;
}

export async function handleEditorialMcp(req, res) {
  if (!configured()) {
    res.status(503).json({
      error: 'editorial_mcp_not_configured'
    });
    return;
  }

  if (!authorized(req)) {
    res.setHeader('WWW-Authenticate', 'Bearer');
    res.status(401).json({
      error: 'unauthorized'
    });
    return;
  }

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined
  });

  res.on('close', () => {
    transport.close();
  });

  await createServer().connect(transport);

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString('utf8');

  await transport.handleRequest(
    req,
    res,
    raw ? JSON.parse(raw) : undefined
  );
}

export async function getEditorialMcpConfig() {
  return {
    configured: configured(),
    blog_id: process.env.MCP_EDITORIAL_BLOG_ID || null
  };
}
