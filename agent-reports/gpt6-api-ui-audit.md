# Relatório — Missão 001: Auditoria GPT-6 de UI/API e propostas

- Agente: GPT-6
- Data: 2026-11-27
- Repositório: `vidift-max/blogger-cannibalization-mcp`
- Branch examinada: `v2-saas-alpha`
- SHA examinado: `cc7e72b360f63cfd4b0bf7f901a4dfb977dca42f`
- Branch de entrega: `coordination/agent-missions`

## 1. Resumo executivo

A revisão estática confirma que as chamadas principais de `public/proposals.html` têm rotas correspondentes no backend. A hipótese anterior de que as rotas de detalhe e rejeição estariam ausentes estava incorreta: ambas existem em `src/zip-import.js`.

Foi identificado um risco relevante de concorrência no endpoint de aprovação: a transação libera o bloqueio do registro e confirma a transação antes da chamada de escrita no Blogger, mas mantém o status como `pending`. Duas requisições simultâneas podem, em princípio, passar pela verificação de pendência e tentar publicar a mesma proposta. Isso requer teste de integração controlado e correção antes de uso com clientes.

A tela também apresenta um resumo de “Total” calculado sobre uma consulta limitada aos 100 registros mais recentes; sem paginação ou indicação do limite, o total exibido pode ser interpretado incorretamente.

## 2. Mapa dos arquivos principais

| Arquivo | Responsabilidade |
|---|---|
| `public/proposals.html` | Lista propostas, carrega detalhes, permite copiar HTML, aprovar ou rejeitar e recalcular contagens |
| `src/index.js` | Monta o router sob `/api`, aplica JSON, cookies e limite simples de requisições |
| `src/routes.js` | Lista propostas, cria propostas, recalcula contagens, aprova e restaura |
| `src/zip-import.js` | Consulta detalhes e rejeita propostas criadas/importadas pelo fluxo ZIP |
| `src/security.js` | Utilitários de segurança referenciados pelo middleware de sessão/CSRF |

## 3. Compatibilidade UI/API

| Ação da interface | Rota backend | Status | Evidência |
|---|---|---|---|
| Listar propostas | `GET /api/proposals` | PASS estático | `public/proposals.html`; `src/routes.js:1165-1201` |
| Abrir detalhes | `GET /api/proposals/:id` | PASS estático | `public/proposals.html`; `src/zip-import.js:455-490` |
| Rejeitar | `POST /api/proposals/:id/reject` | PASS estático | `public/proposals.html`; `src/zip-import.js:492-528` |
| Aprovar/publicar | `POST /api/proposals/:id/approve` | PASS estático | `public/proposals.html`; `src/routes.js:1221-1395` |
| Recalcular contagens | `POST /api/proposals/recalculate-counts` | PASS estático | `public/proposals.html`; `src/routes.js:1074-1162` |
| Prefixo `/api` | `app.use('/api', router)` | PASS estático | `src/index.js:31` |

As rotas mutáveis acima usam `currentUser` e `requireCsrf`. A interface envia `x-csrf-token` nas requisições POST. A consulta de detalhes e a listagem são somente leitura e usam autenticação de sessão.

## 4. Problemas encontrados

### P1 — Janela de concorrência no fluxo de aprovação

- Arquivo: `src/routes.js`
- Evidência: linhas 1221-1300 selecionam a proposta com `FOR UPDATE`, verificam `status === 'pending'`, executam um UPDATE que mantém o status como `pending` e fazem `COMMIT` antes da chamada externa ao Blogger (linhas 1302-1334).
- Impacto: após o COMMIT, o bloqueio da linha é liberado. Uma segunda requisição concorrente pode encontrar a mesma proposta ainda pendente e também prosseguir para `updatePost`.
- Correção proposta: introduzir estado intermediário explícito, por exemplo `processing`, dentro da transação, com transições condicionais e recuperação segura de operações interrompidas. Não manter transação SQL aberta durante a chamada de rede. Definir idempotência/reconciliação para o caso em que o Blogger conclui a escrita, mas a atualização local falha.
- Testes necessários: duas aprovações concorrentes para a mesma proposta; falha antes da chamada Blogger; falha após escrita remota e antes da confirmação local; repetição após timeout.

### P2 — Contagem “Total” limitada aos 100 registros mais recentes

- Arquivos: `src/routes.js:1165-1186` e `public/proposals.html`
- Evidência: a consulta de listagem usa `ORDER BY pb.id DESC LIMIT 100`; a interface calcula `Total: ` usando `proposals.length`.
- Impacto: quando existirem mais de 100 propostas, a interface apresenta o total carregado, não o total real da conta.
- Correção proposta: implementar paginação explícita ou retornar um total separado via `COUNT(*)`; ajustar o rótulo da interface para “Exibidas” enquanto não houver total global.
- Testes necessários: conta com 0, 1, 100 e mais de 100 propostas.

### P3 — Verificação de versão do post no Blogger é limitada

- Arquivo: `src/routes.js:1307-1326`
- Evidência: a proteção compara `live.updated` com `local_updated_at` e bloqueia quando a data remota é posterior. O README também descreve esta comparação como proteção básica, não controle de versão forte.
- Impacto: timestamp não é um mecanismo robusto de concorrência/controle de versão; alterações concorrentes podem não ser detectadas em todos os cenários.
- Correção proposta: avaliar ETag/If-Match ou outro identificador de versão oferecido pela API Blogger; caso indisponível, documentar claramente a limitação e exigir nova sincronização imediatamente antes da aprovação.
- Testes necessários: alteração externa entre sincronização e aprovação, timestamps iguais e relógios/precisão divergentes.

## 5. Testes executados

- Revisão estática de arquivos no GitHub na branch `v2-saas-alpha`.
- Conferência das rotas e dos caminhos chamados pela interface.
- Conferência do middleware de montagem `/api` em `src/index.js`.
- **Não foram executados testes automatizados nem chamadas HTTP reais nesta auditoria.** O ambiente desta revisão não clonou/instalou o projeto nem executou PostgreSQL ou Blogger OAuth. Portanto, compatibilidade foi marcada como PASS estático, não como teste de runtime.

## 6. Riscos e prioridades

1. P1: corrigir e testar a concorrência de aprovação antes de permitir uso real.
2. P2: corrigir a semântica do total de propostas ou implementar paginação.
3. P3: fortalecer a proteção contra atualização externa concorrente.
4. Executar `npm test` e `npm run check` em ambiente controlado, além de testes de integração com mocks do Blogger e PostgreSQL.

## 7. Proposta para a Missão 002

Implementar e testar a transição atômica de estado da aprovação (`pending -> processing -> applied/failed` ou equivalente), com idempotência e estratégia explícita de recuperação. Adicionar testes de concorrência e de falhas parciais. Em tarefa separada, corrigir o total/paginação de propostas.

## 8. Declaração de integridade

Nenhum código de produção foi alterado nesta auditoria. Não houve publicação no Blogger, deploy, merge, alteração de segredos, acesso a dados reais de usuários ou exclusão de dados. Nenhuma chamada de aprovação/rejeição foi executada.
