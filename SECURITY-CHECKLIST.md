# Checklist obrigatório antes de produção

- [ ] Instalar dependências e executar `npm test` e `npm run check`.
- [ ] Executar testes de integração com projeto Google e blog de teste.
- [ ] Testar isolamento entre dois usuários em todas as rotas.
- [ ] Revisão independente das rotas de aprovação e restauração.
- [ ] Adicionar fila/reconciliação para falhas entre Blogger e PostgreSQL.
- [ ] Implementar sanitização e diff HTML seguro, preservando widgets Blogger.
- [ ] Substituir rate limit em memória por solução compartilhada.
- [ ] Adicionar timeout, retry/backoff e monitoramento.
- [ ] Criar política de privacidade, termos, retenção/exclusão e processo LGPD.
- [ ] Revisar escopos e requisitos de verificação OAuth do Google.
- [ ] Configurar backups do PostgreSQL e testar restauração.
- [ ] Só então avaliar implantação e abertura para usuários.
