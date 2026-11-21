import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

test('MCP SDK stateless JSON transport completes initialize and tool call', async () => {
  const serverHttp = http.createServer(async (req, res) => {
    if (req.method !== 'POST') {
      res.writeHead(405, { allow: 'POST' });
      res.end();
      return;
    }

    const body = await readJsonBody(req);
    const server = new McpServer(
      { name: 'mcp-protocol-test', version: '1.0.0' },
      { capabilities: { tools: {} } }
    );

    server.registerTool(
      'ping',
      { description: 'Protocol test tool' },
      async () => ({
        content: [{ type: 'text', text: 'pong' }]
      })
    );

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true
    });

    res.on('close', () => {
      void transport.close();
      void server.close();
    });

    await server.connect(transport);
    await transport.handleRequest(req, res, body);
  });

  await new Promise((resolve, reject) => {
    serverHttp.listen(0, '127.0.0.1', error => error ? reject(error) : resolve());
  });

  const address = serverHttp.address();
  assert.equal(typeof address, 'object');

  const client = new Client({ name: 'mcp-protocol-test-client', version: '1.0.0' });
  const transport = new StreamableHTTPClientTransport(
    new URL(`http://127.0.0.1:${address.port}/mcp`)
  );

  try {
    await client.connect(transport);
    const result = await client.callTool({ name: 'ping', arguments: {} });
    assert.equal(result.isError, undefined);
    assert.equal(result.content[0].type, 'text');
    assert.equal(result.content[0].text, 'pong');
  } finally {
    await client.close();
    await new Promise(resolve => serverHttp.close(resolve));
  }
});
