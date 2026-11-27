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


## Finalização técnica — branch de trabalho
- Aprovação e restauração agora reivindicam um estado intermediário atômico antes de chamar o Blogger.
- Resultados externos ambíguos entram em reconciliação; o endpoint compara o HTML remoto exatamente com original/proposta e não envia conteúdo.
- Rotas de detalhe e rejeição foram adicionadas para corresponder à interface existente.
- Contadores de lotes são atualizados quando propostas são publicadas, rejeitadas ou restauradas.
- Migrações SQL passam a ser versionadas e executadas uma única vez com lock advisory.
- Verificação sintática cobre todos os módulos e há workflow de CI.
- Ainda requer CI verde, teste de integração com Blogger de teste e validação operacional do banco antes de produção.
