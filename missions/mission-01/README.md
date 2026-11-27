# Missão 01 — Diagnóstico e plano de conclusão do Blogger

**Coordenação técnica:** GPT-6  
**Escopo exclusivo:** Blogger / Blogger SEO Intelligence  
**Branch de trabalho:** `feat/article-content-architecture` (não alterar `main`)  
**Branch de coordenação e entrega:** `coordination/agent-missions`

## Objetivo
Avaliar o estado real do projeto e produzir um plano verificável para concluir a arquitetura e a interface, aproximando a experiência administrativa do Blogger original (Blogger.com), sem remover nem enfraquecer o diferencial Blogger SEO Intelligence.

## Contexto confirmado
O README da branch `coordination/agent-missions` descreve a versão como **v2.0 alpha.2**, uma reconstrução alpha, ainda não pronta para clientes. Ele registra OAuth Google com escopo Blogger, tokens criptografados, sessões/CSRF, PostgreSQL multiusuário, sincronização de blogs e artigos, análise heurística de similaridade e propostas com backup/aprovação. Também lista lacunas: editor visual de propostas, integração real e testes completos com Blogger, controles multi-tenant, segurança independente, monitoramento, LGPD, termos e cobrança. Não assumir que qualquer item está concluído sem verificar código e testes.

A branch `main` tem README de um MVP anterior, descrito como servidor MCP somente leitura e de blog único. Não misturar esse estado com o alpha da branch de coordenação.

## Trabalho solicitado nesta missão
1. Inspecionar as branches `coordination/agent-missions`, `feat/article-content-architecture`, `v2-saas-alpha` e `main`; identificar a base correta e diferenças relevantes.
2. Mapear a arquitetura existente (frontend, backend, banco, autenticação OAuth, integração Blogger, serviços, rotas, testes e deploy).
3. Comparar a experiência administrativa existente com os fluxos do Blogger.com: visão geral, postagens, páginas, comentários, estatísticas, ganhos quando aplicável, layout/tema e configurações. Registrar o que existe, falta ou não se aplica.
4. Auditar a arquitetura de conteúdo e o editor: criação/edição de artigos e páginas, rascunhos, preview, salvamento, histórico/backup e fluxo de aprovação.
5. Auditar Blogger SEO Intelligence: detecção de similaridade/canibalização, intenção de busca, metadados, integração Search Console (se existir) e limites da análise heurística.
6. Executar os testes e verificações disponíveis sem alterar produção. Registrar comandos, resultados, falhas e limitações.
7. Produzir um plano priorizado por risco e dependência para concluir o projeto, com tarefas pequenas e critérios de aceitação mensuráveis.

## Restrições
- Não trabalhar em AI Phone, AI Messenger, AI Bridge Browser ou qualquer outro projeto.
- Não publicar, editar ou excluir conteúdo em blogs reais.
- Não executar deploy, migrações destrutivas, reset de banco, rotação de segredos ou mudanças de produção.
- Não expor tokens, cookies, credenciais, chaves ou dados pessoais nos relatórios.
- Não fazer merge em `main`. Trabalhar em branch própria derivada da base correta e informar o SHA inicial.
- Não afirmar que algo foi testado em Blogger real se foi apenas simulado ou unitário.
- Não reconstruir o Blogger.com por cópia de marca/ativos proprietários; reproduzir padrões de usabilidade familiares mantendo identidade própria.

## Entrega obrigatória
Criar o relatório em:
`missions/mission-01/REPORT.md`

O relatório deve conter:
- status geral: PASS / NO-GO / BLOCKED;
- branch, SHA inicial e SHA final;
- inventário da arquitetura com caminhos de arquivos;
- matriz Blogger.com × projeto (existente / parcial / ausente / não aplicável);
- testes executados, comandos e resultados;
- riscos e bloqueios com evidências;
- plano priorizado para a Missão 02;
- lista explícita do que NÃO foi alterado.

Atualizar também `missions/mission-01/STATUS.md` com status, último SHA e resumo curto. Se não conseguir criar os arquivos no GitHub, devolver o conteúdo completo e explicar o bloqueio.

## Critério de encerramento
A missão só termina quando o relatório estiver commitado na branch `coordination/agent-missions`, com links e SHA verificáveis, ou quando um bloqueio concreto for documentado. Não declarar o projeto concluído nesta missão: esta é apenas a fase de diagnóstico e planejamento.
