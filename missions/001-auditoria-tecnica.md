# MISSÃO 001 — Auditoria técnica inicial do Blogger SEO Intelligence

**Coordenador:** GPT-6  
**Repositório:** https://github.com/vidift-max/blogger-cannibalization-mcp  
**Branch de referência:** `v2-saas-alpha`  
**Branch desta missão:** `coordination/agent-missions`  
**Escopo:** Blogger SEO Intelligence. Não trabalhar no AI Phone nem no AI Bridge Browser.

## Objetivo
Auditar o estado real do projeto e entregar um relatório verificável para o GPT-6 decidir a próxima missão.

## Tarefas
1. Examine a estrutura do repositório, README, dependências, configuração de deploy, rotas, integração Blogger/OAuth, banco de dados, testes e workflows.
2. Identifique o que está implementado, parcialmente implementado, ausente e quebrado. Não presuma que algo funciona só porque existe código.
3. Execute apenas testes e verificações locais/seguras disponíveis. Registre comandos e resultados reais.
4. Priorize riscos e erros que impedem o fluxo principal: conectar Blogger, importar/consultar conteúdo, analisar SEO e preparar conteúdo para edição/cópia manual.
5. Considere IA somente como apoio à geração de texto. **Não implementar integração automática com IA nesta fase.**
6. Não publicar no Blogger, não acessar/alterar dados reais de usuários, não fazer deploy, não mesclar branches, não alterar segredos e não apagar dados.
7. Não modificar a branch principal nem fazer commits de código nesta missão. Se encontrar correções necessárias, descreva arquivos, causa, solução proposta e testes necessários.

## Entrega obrigatória
Crie o relatório em:
`agent-reports/mission-001-audit.md`

O relatório deve conter:
- resumo executivo;
- branch e SHA exatos examinados;
- mapa dos principais arquivos;
- tabela de funcionalidades com status **PASS / PARTIAL / FAIL / NOT VERIFIED**;
- testes executados, comandos e saídas relevantes;
- problemas encontrados com evidências (arquivo e linha, quando possível);
- riscos e prioridades;
- proposta objetiva para a Missão 002.

## Critério de conclusão
A missão só está entregue quando o relatório estiver commitado nesta branch de coordenação e você informar o link direto do arquivo, SHA do commit e um resumo curto. Se algo bloquear, registre o bloqueio no relatório em vez de inventar resultado.

**Importante:** Não declare teste, deploy ou integração como concluído sem evidência. Preserve o trabalho existente.
