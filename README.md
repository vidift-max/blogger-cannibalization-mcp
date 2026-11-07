# Blogger Cannibalization MCP

Read-only MCP server for a public Blogger feed. It indexes posts in SQLite and exposes tools for article similarity and keyword cannibalization analysis.

## Configuration
Copy `.env.example` to `.env` if customization is needed. No Google, Blogger, or OpenAI API key is required for the public feed.

## Run

```bash
npm install
npm test
npm run smoke
npm start
```

Health endpoint: `/healthz`
MCP endpoint: `/mcp`

The current MVP is single-blog and read-only. It is intended to read `https://www.statesidemoney.com` by default.


## Deploy no Render (MVP)

O projeto inclui `render.yaml`. No Render, crie um Web Service a partir deste repositório, use o plano Free para teste e deixe `MCP_AUTH_TOKEN` vazio inicialmente. O endpoint será `/mcp` e o health check `/healthz`.

Observação: o plano Free do Render usa filesystem efêmero. Como este projeto consegue reconstruir o índice a partir do feed público do Blogger ao iniciar, a perda do SQLite em restart/redeploy não impede o funcionamento; o primeiro sync pode levar algum tempo. Para produção, use armazenamento persistente ou banco gerenciado.
