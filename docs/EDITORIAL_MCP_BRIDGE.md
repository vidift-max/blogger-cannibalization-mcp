# Editorial MCP Bridge

## Purpose

The application can expose a **read-only MCP endpoint** so a compatible AI client can query the latest synchronized Blogger corpus while preparing a new finance-news article.

The bridge is intentionally narrower than the authenticated application API. It exposes only the editorial brief needed to choose an angle and avoid likely topic/search-intent overlap.

## MCP endpoint

- HTTP endpoint: `/mcp` (POST only)
- Transport: MCP Streamable HTTP in stateless JSON-response mode
- Authentication: `Authorization: Bearer <MCP_EDITORIAL_TOKEN>`
- Tool: `get_editorial_brief`

Tool inputs:

- `query`: topic or subject of the candidate news article
- `title`: optional candidate source title

The response contains:

- synchronized timestamp;
- corpus size;
- relevant existing articles/pages;
- evidence-based cannibalization findings;
- occupied topics;
- high-risk document IDs;
- editorial context for selecting a differentiated angle.

## Isolation and safety

The bridge:

- is disabled unless both `MCP_EDITORIAL_TOKEN` and `MCP_EDITORIAL_BLOG_ID` are configured;
- is read-only;
- does not expose Blogger OAuth tokens;
- does not expose proposal, approval, publish, restore, or sync mutations;
- does not publish anything to Blogger;
- uses a scoped blog ID configured by the deployment;
- returns `401` for invalid bearer credentials;
- returns `503` when the bridge is not explicitly configured;
- applies a per-IP request limit to the `/mcp` endpoint before MCP processing;
- rejects non-POST requests with `405`;
- validates browser `Origin` headers against `MCP_EDITORIAL_ALLOWED_ORIGINS` when configured.

The token is a deployment secret and must never be committed to Git.

## Freshness model

The platform remains responsible for synchronizing Blogger. The AI client does **not** keep a permanent copy of the corpus.

When the tool is called, it reads the currently synchronized database state and returns its `synced_at` value. This implements the intended model:

**Blogger sync → current corpus → AI query on demand**

It does not claim that GPT-6 can monitor Blogger continuously in the background.

## Current integration boundary

Adding this endpoint makes the application technically MCP-compatible, but it does **not** by itself install or connect the tool to ChatGPT.

A compatible ChatGPT MCP/connector configuration still has to be created and authorized for the deployed `/mcp` endpoint. Before that external step, the repository must pass its automated protocol and route tests. Until that external connection is configured and tested, direct GPT-6 access remains BLOCKED at the integration boundary.

The application-side bridge therefore must be reported as:

**IMPLEMENTED / NOT YET CONNECTED TO CHATGPT**

## Intended editorial workflow

1. User asks GPT-6 for a new finance-news article.
2. GPT-6 calls `get_editorial_brief` with the candidate topic/title.
3. GPT-6 compares the brief with current news search results.
4. GPT-6 returns the news link plus focused instructions:
   - what existing angle to avoid;
   - which overlap is high risk;
   - which underused angle is preferable;
   - what evidence supports the recommendation.
5. The user gets the main creation prompt from the platform's Área de Criação.
6. The user manually combines the platform prompt with GPT-6's news link and editorial guidance and sends it to Claude.
7. Claude returns raw HTML.
8. The user pastes the HTML into the platform.
9. The platform validates, interprets, and assembles the final article using its own architecture.

GPT-6 is therefore an editorial intelligence layer, not the owner of the Claude prompt or final HTML architecture.


## Freshness signal

The `get_editorial_brief` response includes `sync_age_seconds` alongside `synced_at`. GPT-6 should treat this as evidence of corpus freshness, not as proof that Blogger is continuously monitored. If freshness is too old for the editorial task, the platform must synchronize the blog before relying on the brief.
## Deployment configuration

The bridge requires two Render environment variables on the deployed service:

- `MCP_EDITORIAL_TOKEN`: a strong secret bearer token; never commit or place it in source control.
- `MCP_EDITORIAL_BLOG_ID`: the single Blogger blog ID that this bridge is allowed to query.
- `MCP_EDITORIAL_ALLOWED_ORIGINS`: optional comma-separated browser origins. If an `Origin` header is present, it must match one of these values; requests without an `Origin` header remain allowed for non-browser MCP clients.

Configuration is intentionally deployment-scoped. The bridge does not accept a blog ID from the MCP caller, preventing a caller from selecting another tenant's corpus.

Do not expose these values in diagnostics, logs, prompts, or client-visible error messages. Configure them only through the service's secret/environment-variable mechanism.
