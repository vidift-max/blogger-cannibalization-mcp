# Trabalho paralelo GPT-6 — auditoria de integração entre interface e API

**Missão compartilhada:** 001  
**Responsável:** GPT-6  
**Repositório:** https://github.com/vidift-max/blogger-cannibalization-mcp  
**Branch examinada:** `v2-saas-alpha`  
**SHA:** `cc7e72b360f63cfd4b0bf7f901a4dfb977dca42f`

## Objetivo
Enquanto o agente parceiro faz a auditoria geral definida em `missions/001-auditoria-tecnica.md`, GPT-6 verifica a compatibilidade entre as chamadas da interface e as rotas do servidor, além dos pontos críticos do fluxo de propostas.

## Tarefas
1. Conferir cada endpoint usado em `public/*.html` contra as rotas de `src/routes.js`, `src/correction-batches.js` e `src/zip-import.js`.
2. Registrar chamadas sem rota correspondente, respostas incompatíveis e controles de autenticação/CSRF inconsistentes.
3. Revisar o caminho de criar, consultar, rejeitar, aprovar e restaurar propostas, sem chamar endpoints reais.
4. Não alterar código nesta etapa. Não fazer deploy, merge, publicação no Blogger nem alterações em dados reais.
5. Entregar evidências com caminhos e linhas e propor correções mínimas/testes.

## Entrega
Relatório em `agent-reports/gpt6-api-ui-audit.md` na branch `coordination/agent-missions`.
