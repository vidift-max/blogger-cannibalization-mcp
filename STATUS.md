# Status — v2.0 alpha.2

Reconstrução corrigida preparada para auditoria e testes. Não representa a versão original Kimi v2.

Melhorias em relação ao alpha.1:
- Corrigida a separação entre ID interno do blog e ID do Blogger.
- Persistência de tokens renovados pelo cliente OAuth.
- Preservação do refresh token quando o Google não devolve um novo.
- Proteção CSRF para rotas de alteração.
- Limite básico de requisições.
- Auditoria de eventos.
- Rota de restauração de backup.
- Checagem básica de alteração remota antes de aprovar.
- `.env.example`, `.gitignore` e `.dockerignore` na raiz.

Não implantado. Não conectado a banco de produção. Não validado com conta Blogger real.
