# Blogger Cannibalization AI — v2.0 alpha.2

Esta é uma reconstrução alpha corrigida, não a versão original que a ferramenta Kimi informou ter criado. Ainda não é um produto pronto para clientes.

## Recursos presentes
- Login Google OAuth com escopo Blogger.
- Armazenamento criptografado de tokens (AES-256-GCM).
- Sessões por usuário, hash de sessão e token CSRF.
- Banco PostgreSQL com dados vinculados ao usuário.
- Listagem e sincronização paginada de blogs e artigos.
- Análise heurística de similaridade textual.
- Propostas de alteração guardadas como backup.
- Aprovação e tentativa de restauração de backup.
- Registro básico de auditoria e limite simples de requisições.

## Instalação local
1. Requer Node.js 20+ e PostgreSQL.
2. Copie `.env.example` para `.env`.
3. Gere `TOKEN_ENCRYPTION_KEY` com 32 bytes aleatórios em hexadecimal (64 caracteres).
4. Configure credenciais OAuth no Google Cloud e a URI exata de callback.
5. `npm install`, `npm test`, `npm run check`, `npm start`.

## Callback OAuth
`https://SEU-DOMINIO/api/oauth/google/callback`

## Limitações conhecidas — não usar com clientes reais ainda
- A aprovação/restore não é uma transação distribuída com o Blogger. Em falha de rede após escrita, o estado pode exigir reconciliação manual.
- A comparação de data do post é uma proteção básica, não um controle de versão forte.
- O limite de requisições é em memória e por instância; trocar por Redis ou gateway antes de escalar.
- Falta revisão de segurança independente, testes de integração com Blogger real, testes multi-tenant completos, monitoramento, política de privacidade, termos, LGPD e cobrança.
- O editor de propostas ainda não foi construído na interface: as rotas existem, mas a criação e aprovação visual de HTML precisa ser concluída.
- O algoritmo de similaridade não comprova canibalização; integrar Search Console e análise de intenção de busca antes de decisões automáticas.

Nunca publique alterações automaticamente. Nunca coloque `.env`, tokens, client secret ou chave de criptografia no GitHub.

## Ponte MCP editorial (somente leitura)

A ponte `POST /mcp` disponibiliza a ferramenta `get_editorial_brief`, que consulta artigos e páginas já sincronizados do blog configurado. Ela não altera nem publica conteúdo no Blogger.

Para habilitá-la, configure no ambiente do servidor:
- `MCP_EDITORIAL_TOKEN`: segredo Bearer forte e exclusivo.
- `MCP_EDITORIAL_BLOG_ID`: ID interno do blog autorizado.
- `MCP_EDITORIAL_ALLOWED_ORIGINS`: origens de navegador permitidas, separadas por vírgula (opcional; requisições sem cabeçalho Origin não são bloqueadas por esta regra).
- `MCP_EDITORIAL_MAX_SYNC_AGE_SECONDS`: idade máxima do corpus em segundos; padrão `86400` (24 horas). Valor `0` exige sincronização no mesmo segundo.

A resposta inclui `synced_at`, `sync_age_seconds` e `corpus_freshness.status` (`fresh`, `stale` ou `unknown`). Um corpus `stale` ou `unknown` deve ser tratado como contexto insuficiente para decisões editoriais até uma nova sincronização confirmada.

Mantenha o token apenas nas variáveis secretas do ambiente de execução. Não o coloque no repositório, em prompts públicos, logs ou no navegador. A inclusão dessas variáveis em `.env.example` serve apenas como documentação; deixá-las vazias mantém a ponte desabilitada.
