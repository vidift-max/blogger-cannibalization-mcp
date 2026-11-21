# Architecture Registry

The registry is the platform-side source of truth for article assembly.

It deliberately does not expose implementation code to the content provider.

## Version 1

- Template: `article`
- Slots: header, intro, body, interactions, related_carousel, faq, conclusion
- Interaction renderer: platform-owned
- Related-link selector: platform-owned
- Provider responsibility: editorial content only

## CSS and JavaScript boundary

CSS and JavaScript are implementation assets of the platform. Future designer work must register components and their selectors here rather than adding implementation requirements to the provider prompt.

## Provider boundary

The provider may describe content and structured interaction data. It must not emit:

- HTML;
- CSS;
- JavaScript;
- inline styles;
- arbitrary component names;
- publication URLs for related content.

## Future integration

The final assembly pipeline should be:

1. fetch/receive structured editorial content;
2. validate provider output;
3. normalize blocks;
4. render blocks into the platform template;
5. select related articles from the online Blogger corpus;
6. select supported interactions;
7. render the registered CSS/JS components;
8. run SEO/cannibalization checks;
9. preview;
10. require approval before publishing.

## Cannibalization analysis contract

The analysis layer is evidence-first. It may identify candidate conflicts using title,
content, labels, headings, topic groups and search-intent signals, but it must not
declare a definitive Google ranking conflict without external performance evidence.

Each finding should expose the evidence and distinguish:
- likely same search intent;
- distinct search intent;
- shared main topic;
- different main topics;
- structural/content overlap.

Search Console or equivalent query/page performance data remains the preferred
confirmation source before consolidation, redirect or deletion decisions.

## Unified SEO corpus

Analysis runs operate on a single corpus containing Blogger posts and pages.
Every document carries a stable local id, title, URL, content and document type.
Findings preserve both document types so an article competing with a landing/page
can be reviewed as one SEO relationship instead of two isolated datasets.

The analysis endpoint reports article count, page count and total corpus size.


## Contexto editorial consultável

O corpus sincronizado de artigos e páginas pode ser consultado por uma busca editorial autenticada em `/blogs/:blogId/editorial-context?q=...`. A plataforma retorna apenas um subconjunto relevante, com título, URL, tipo de documento, termos coincidentes e pequeno trecho. O campo `synced_at` informa a data da última sincronização conhecida.

Esse endpoint é uma camada de preparação para a futura ponte de consulta do GPT-6. Ele não concede publicação nem alteração no Blogger e não substitui a análise completa de canibalização.


### Brief editorial para nova notícia

A rota `/blogs/:blogId/editorial-brief?q=...&title=...` combina o subconjunto relevante do corpus com os achados de análise de canibalização. O resultado inclui documentos relevantes, conflitos de intenção/tópico, tópicos já ocupados e IDs de documentos classificados como HIGH. Essa camada serve para orientar o ângulo de uma nova notícia; não transforma similaridade em prova de disputa no Google.


## Editorial MCP bridge (read-only)

The application now has an optional MCP Streamable HTTP bridge at `/mcp` for the editorial workflow. It exposes only `get_editorial_brief`, scoped by `MCP_EDITORIAL_BLOG_ID` and protected by `MCP_EDITORIAL_TOKEN`. It reads the latest synchronized Blogger corpus and never exposes Blogger OAuth credentials or mutation endpoints. The bridge is application-side infrastructure; a separate compatible ChatGPT MCP/connector configuration and authorization are still required before GPT-6 can call it directly. See `docs/EDITORIAL_MCP_BRIDGE.md`.
