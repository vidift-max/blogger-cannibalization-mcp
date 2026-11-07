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
