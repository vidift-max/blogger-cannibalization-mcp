import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import { buildEditorialBrief } from './editorial-brief.js';
import { query } from './db.js';
import { isEditorialMcpConfigured, isEditorialMcpMethodAllowed, isEditorialMcpOriginAllowed, authorizeEditorialMcpRequest, syncAgeSeconds } from './editorial-mcp-auth.js';

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
                sync_age_seconds: syncAgeSeconds(blog.synced_at),
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
  if (!isEditorialMcpMethodAllowed(req.method)) {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  if (!isEditorialMcpOriginAllowed(req.headers.origin)) {
    res.status(403).json({ error: 'origin_not_allowed' });
    return;
  }

  if (!isEditorialMcpConfigured()) {
    res.status(503).json({
      error: 'editorial_mcp_not_configured'
    });
    return;
  }

  if (!authorizeEditorialMcpRequest(req)) {
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

  try {
    await createServer().connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error('[editorial-mcp]', error?.message || 'request_failed');
    if (!res.headersSent) {
      res.status(500).json({ error: 'editorial_mcp_internal_error' });
    }
  }
}

export async function getEditorialMcpConfig() {
  return {
    configured: isEditorialMcpConfigured(),
    blog_id: process.env.MCP_EDITORIAL_BLOG_ID || null
  };
}
