# GPT-6 — Auditoria API/interface (checkpoint inicial)

- Branch examinada: `v2-saas-alpha`
- SHA: `cc7e72b360f63cfd4b0bf7f901a4dfb977dca42f`
- Tipo: inspeção estática de código; nenhum endpoint foi executado.

## Achado confirmado: página de propostas chama endpoints não encontrados no backend

A interface `public/proposals.html`:
- consulta `GET /api/proposals` (linhas 188–203);
- consulta `GET /api/proposals/:id` (linhas 342–364);
- envia `POST /api/proposals/:id/approve` ou `POST /api/proposals/:id/reject` (linhas 396–428).

No arquivo `src/routes.js`, a inspeção identificou:
- `GET /proposals` (linhas 1165–1201);
- `POST /proposals/:id/approve` (linhas 1221–1395);
- `POST /proposals/:id/restore` (linhas 1404–1511).

O arquivo termina na linha 1512. Não há rota registrada para `GET /proposals/:id` nem `POST /proposals/:id/reject` no backend inspecionado. Portanto, a tela depende de duas operações que não aparecem implementadas na versão examinada. Resultado esperado: abrir detalhes ou rejeitar proposta deve falhar com 404, salvo se houver outro middleware/serviço externo que registre essas rotas (não identificado no repositório).

## Fluxo existente
- Criar proposta individual: `POST /posts/:postId/proposals` em `src/routes.js`, linhas 972–1064.
- Criar proposta no lote: `POST /correction-batches/:batchId/items/:itemId/proposal` em `src/correction-batches.js`, linhas 489–722.
- Aprovar proposta: existe rota explícita e protegida por sessão + CSRF em `src/routes.js`, linhas 1221–1395.
- Restaurar backup aplicado: existe rota em `src/routes.js`, linhas 1404–1511.
- A tela deixa claro que aprovação envia conteúdo ao Blogger e pede confirmação (`public/proposals.html`, linhas 399–405).

## Outro ponto de atenção
A rota de aprovação confirma a proposta como pendente, faz COMMIT da transação local e só depois chama o Blogger (`src/routes.js`, linhas 1286–1334). A atualização externa e a confirmação local são etapas separadas; falhas de rede precisam de reconciliação/idempotência. O README já descreve limitação semelhante. Não executei esse fluxo.

## Próximos passos
1. Completar a auditoria de todos os endpoints da interface.
2. Validar se a rejeição deve atualizar status e lote de forma consistente.
3. Definir comportamento de reconciliação quando a API Blogger falhar após a aprovação.
4. Implementar somente após relatório conjunto e testes automatizados cobrirem o fluxo.

## Segurança e limites
Nenhum código foi alterado na branch principal. Nenhuma conta Blogger foi conectada. Nenhuma publicação, deploy, merge ou alteração de dados reais foi feita.
