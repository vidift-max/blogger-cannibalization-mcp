
import express from 'express';
import { pool, query } from './db.js';
import { countChangedSections } from './diff-count.js';

/*
 * ============================================================
 * CORRECTION BATCHES
 * ============================================================
 *
 * Responsável por:
 *
 * - criar lotes de correções;
 * - listar lotes;
 * - consultar um lote;
 * - adicionar artigos a um lote;
 * - remover artigos de um lote;
 * - receber HTML corrigido;
 * - criar propostas vinculadas aos lotes;
 * - preservar os HTMLs originais.
 *
 * IMPORTANTE:
 * Este arquivo NÃO publica nada no Blogger.
 * A publicação depende de aprovação explícita.
 * ============================================================
 */

export function createCorrectionBatchesRouter({
  currentUser,
  requireCsrf
}) {
  const router = express.Router();

  /*
   * ============================================================
   * FUNÇÃO AUXILIAR: RECALCULAR CONTADORES
   * ============================================================
   */

  async function updateBatchCounters(db, batchId) {
    await db.query(
      `
      UPDATE correction_batches
      SET
        total_items = (
          SELECT COUNT(*)
          FROM correction_batch_items
          WHERE batch_id=$1
        ),

        pending_items = (
          SELECT COUNT(*)
          FROM correction_batch_items
          WHERE batch_id=$1
            AND status='pending'
        ),

        approved_items = (
          SELECT COUNT(*)
          FROM correction_batch_items
          WHERE batch_id=$1
            AND status='approved'
        ),

        published_items = (
          SELECT COUNT(*)
          FROM correction_batch_items
          WHERE batch_id=$1
            AND status='published'
        ),

        rejected_items = (
          SELECT COUNT(*)
          FROM correction_batch_items
          WHERE batch_id=$1
            AND status='rejected'
        ),

        updated_at=NOW()

      WHERE id=$1
      `,
      [batchId]
    );
  }

  /*
   * ============================================================
   * CRIAR NOVO LOTE
   *
   * POST /api/correction-batches
   * ============================================================
   */

  router.post(
    '/correction-batches',
    currentUser,
    requireCsrf,
    async (req, res, next) => {
      try {
        const { blogId, name } = req.body || {};

        if (!blogId) {
          return res.status(400).json({
            error: 'blog_id_required'
          });
        }

        const batchName =
          String(name || '').trim() ||
          `Lote de correções — ${new Date().toLocaleString('pt-BR')}`;

        const blogResult = await query(
          `
          SELECT id, name, url
          FROM blogs
          WHERE id=$1
            AND user_id=$2
          `,
          [
            blogId,
            req.user.id
          ]
        );

        if (!blogResult.rowCount) {
          return res.status(404).json({
            error: 'blog_not_found'
          });
        }

        const result = await query(
          `
          INSERT INTO correction_batches (
            user_id,
            blog_id,
            name,
            status,
            total_items,
            pending_items,
            approved_items,
            published_items,
            rejected_items
          )
          VALUES (
            $1,
            $2,
            $3,
            'pending',
            0,
            0,
            0,
            0,
            0
          )
          RETURNING *
          `,
          [
            req.user.id,
            blogId,
            batchName
          ]
        );

        return res.status(201).json({
          batch: result.rows[0]
        });

      } catch (e) {
        next(e);
      }
    }
  );

  /*
   * ============================================================
   * LISTAR LOTES
   *
   * GET /api/correction-batches?blogId=1
   * ============================================================
   */

  router.get(
    '/correction-batches',
    currentUser,
    async (req, res, next) => {
      try {
        const { blogId } = req.query;

        const params = [req.user.id];

        let where = `
          WHERE cb.user_id=$1
        `;

        if (blogId) {
          params.push(blogId);

          where += `
            AND cb.blog_id=$2
          `;
        }

        const result = await query(
          `
          SELECT
            cb.id,
            cb.user_id,
            cb.blog_id,
            cb.name,
            cb.status,
            cb.total_items,
            cb.pending_items,
            cb.approved_items,
            cb.published_items,
            cb.rejected_items,
            cb.created_at,
            cb.updated_at,

            b.name AS blog_name,
            b.url AS blog_url

          FROM correction_batches cb

          INNER JOIN blogs b
            ON b.id=cb.blog_id

          ${where}

          ORDER BY cb.created_at DESC
          `,
          params
        );

        res.json({
          batches: result.rows
        });

      } catch (e) {
        next(e);
      }
    }
  );

  /*
   * ============================================================
   * CONSULTAR UM LOTE
   *
   * GET /api/correction-batches/:batchId
   * ============================================================
   */

  router.get(
    '/correction-batches/:batchId',
    currentUser,
    async (req, res, next) => {
      try {
        const batchId = req.params.batchId;

        const batchResult = await query(
          `
          SELECT
            cb.*,
            b.name AS blog_name,
            b.url AS blog_url

          FROM correction_batches cb

          INNER JOIN blogs b
            ON b.id=cb.blog_id

          WHERE cb.id=$1
            AND cb.user_id=$2
          `,
          [
            batchId,
            req.user.id
          ]
        );

        if (!batchResult.rowCount) {
          return res.status(404).json({
            error: 'batch_not_found'
          });
        }

        const itemsResult = await query(
          `
          SELECT
            cbi.id,
            cbi.batch_id,
            cbi.post_id,
            cbi.proposal_id,
            cbi.status,
            cbi.original_html,
            cbi.corrected_html,
            cbi.created_at,
            cbi.updated_at,

            p.title,
            p.url,
            p.blogger_post_id,
            p.updated_at AS post_updated_at,

            pb.status AS proposal_status,
            pb.change_count,
            pb.created_at AS proposal_created_at

          FROM correction_batch_items cbi

          INNER JOIN posts p
            ON p.id=cbi.post_id

          LEFT JOIN post_backups pb
            ON pb.id=cbi.proposal_id

          WHERE cbi.batch_id=$1

          ORDER BY cbi.created_at ASC
          `,
          [batchId]
        );

        res.json({
          batch: batchResult.rows[0],
          items: itemsResult.rows
        });

      } catch (e) {
        next(e);
      }
    }
  );

  /*
   * ============================================================
   * ADICIONAR ARTIGOS A UM LOTE
   *
   * POST /api/correction-batches/:batchId/items
   * ============================================================
   */

  router.post(
    '/correction-batches/:batchId/items',
    currentUser,
    requireCsrf,
    async (req, res, next) => {
      try {
        const batchId = req.params.batchId;

        const postIds = Array.isArray(req.body?.postIds)
          ? req.body.postIds
          : [];

        if (!postIds.length) {
          return res.status(400).json({
            error: 'post_ids_required'
          });
        }

        const normalizedPostIds = [
          ...new Set(
            postIds
              .map(Number)
              .filter(Number.isInteger)
          )
        ];

        if (!normalizedPostIds.length) {
          return res.status(400).json({
            error: 'invalid_post_ids'
          });
        }

        const batchResult = await query(
          `
          SELECT id, blog_id
          FROM correction_batches
          WHERE id=$1
            AND user_id=$2
          `,
          [
            batchId,
            req.user.id
          ]
        );

        if (!batchResult.rowCount) {
          return res.status(404).json({
            error: 'batch_not_found'
          });
        }

        const batch = batchResult.rows[0];

        const postsResult = await query(
          `
          SELECT
            id,
            title,
            url,
            content_html
          FROM posts
          WHERE id=ANY($1::bigint[])
            AND user_id=$2
            AND blog_id=$3
          `,
          [
            normalizedPostIds,
            req.user.id,
            batch.blog_id
          ]
        );

        if (postsResult.rowCount !== normalizedPostIds.length) {
          return res.status(400).json({
            error: 'invalid_posts_for_batch'
          });
        }

        let added = 0;

        for (const post of postsResult.rows) {
          const result = await query(
            `
            INSERT INTO correction_batch_items (
              batch_id,
              post_id,
              status,
              original_html
            )
            VALUES (
              $1,
              $2,
              'pending',
              $3
            )
            ON CONFLICT (batch_id, post_id)
            DO NOTHING
            RETURNING id
            `,
            [
              batchId,
              post.id,
              post.content_html || ''
            ]
          );

          if (result.rowCount) {
            added++;
          }
        }

        await updateBatchCounters(query, batchId);

        res.json({
          ok: true,
          added
        });

      } catch (e) {
        next(e);
      }
    }
  );

  /*
   * ============================================================
   * CRIAR PROPOSTA DE CORREÇÃO DENTRO DO LOTE
   *
   * POST /api/correction-batches/:batchId/items/:itemId/proposal
   *
   * Body:
   *
   * {
   *   "html": "<html>...</html>"
   * }
   *
   * Esta rota:
   * - valida o usuário e o lote;
   * - recupera o HTML original;
   * - compara o original com o corrigido;
   * - cria um backup/proposta;
   * - associa a proposta ao item do lote;
   * - NÃO publica no Blogger.
   * ============================================================
   */

  router.post(
    '/correction-batches/:batchId/items/:itemId/proposal',
    currentUser,
    requireCsrf,
    async (req, res, next) => {
      const client = await pool.connect();

      try {
        const batchId = req.params.batchId;
        const itemId = req.params.itemId;
        const html = req.body?.html;

        if (
          typeof html !== 'string' ||
          !html.trim() ||
          html.length > 1000000
        ) {
          return res.status(400).json({
            error: 'invalid_html',
            message: 'O HTML precisa ser válido e ter no máximo 1 MB.'
          });
        }

        await client.query('BEGIN');

        /*
         * Confirma que o item pertence:
         * - ao lote;
         * - ao usuário;
         * - ao blog correspondente.
         */

        const itemResult = await client.query(
          `
          SELECT
            cbi.id,
            cbi.batch_id,
            cbi.post_id,
            cbi.proposal_id,
            cbi.original_html,
            cbi.status,

            cb.user_id,
            cb.blog_id,

            p.content_html,
            p.title

          FROM correction_batch_items cbi

          INNER JOIN correction_batches cb
            ON cb.id=cbi.batch_id

          INNER JOIN posts p
            ON p.id=cbi.post_id

          WHERE cbi.id=$1
            AND cbi.batch_id=$2
            AND cb.user_id=$3
            AND p.user_id=$3

          FOR UPDATE OF cbi
          `,
          [
            itemId,
            batchId,
            req.user.id
          ]
        );

        if (!itemResult.rowCount) {
          await client.query('ROLLBACK');

          return res.status(404).json({
            error: 'batch_item_not_found',
            message: 'Artigo não encontrado neste lote.'
          });
        }

        const item = itemResult.rows[0];

        /*
         * Evita criar duas propostas pendentes
         * para o mesmo item do lote.
         */

        if (item.proposal_id) {
          const previousProposal = await client.query(
            `
            SELECT id, status
            FROM post_backups
            WHERE id=$1
              AND user_id=$2
            `,
            [
              item.proposal_id,
              req.user.id
            ]
          );

          if (previousProposal.rowCount) {
            const previousStatus =
              previousProposal.rows[0].status;

            if (
              previousStatus === 'pending' ||
              previousStatus === 'applied'
            ) {
              await client.query('ROLLBACK');

              return res.status(409).json({
                error: 'proposal_already_exists',
                message:
                  previousStatus === 'pending'
                    ? 'Este artigo já possui uma proposta aguardando revisão.'
                    : 'Este artigo já possui uma proposta aplicada. Não é possível criar outra pelo mesmo item.'
              });
            }
          }
        }

        /*
         * O HTML original guardado no lote é a referência.
         */

        const previousHtml =
          item.original_html !== null
            ? item.original_html
            : item.content_html || '';

        /*
         * Não cria proposta sem alterações.
         */

        const changeCount = countChangedSections(
          previousHtml,
          html
        );

        if (changeCount === 0) {
          await client.query('ROLLBACK');

          return res.status(400).json({
            error: 'no_changes_detected',
            message: 'O sistema não identificou diferenças entre o original e o corrigido.'
          });
        }

        /*
         * Cria o backup e a proposta.
         */

        const proposalResult = await client.query(
          `
          INSERT INTO post_backups (
            user_id,
            post_id,
            previous_html,
            proposed_html,
            change_count,
            status
          )
          VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            'pending'
          )
          RETURNING
            id,
            post_id,
            status,
            change_count,
            created_at
          `,
          [
            req.user.id,
            item.post_id,
            previousHtml,
            html,
            changeCount
          ]
        );

        const proposal = proposalResult.rows[0];

        /*
         * Vincula a proposta ao artigo do lote.
         */

        await client.query(
          `
          UPDATE correction_batch_items
          SET
            proposal_id=$1,
            corrected_html=$2,
            status='pending',
            updated_at=NOW()
          WHERE id=$3
            AND batch_id=$4
          `,
          [
            proposal.id,
            html,
            itemId,
            batchId
          ]
        );

        await updateBatchCounters(client, batchId);

        await client.query('COMMIT');

        res.status(201).json({
          ok: true,
          proposal,
          message:
            'Proposta criada e vinculada ao lote. O artigo original permanece preservado e nada foi publicado no Blogger.'
        });

      } catch (e) {
        try {
          await client.query('ROLLBACK');
        } catch {}

        next(e);

      } finally {
        client.release();
      }
    }
  );

  /*
   * ============================================================
   * REMOVER UM ARTIGO DO LOTE
   *
   * Não permite remover artigo já publicado.
   * ============================================================
   */

  router.delete(
    '/correction-batches/:batchId/items/:itemId',
    currentUser,
    requireCsrf,
    async (req, res, next) => {
      try {
        const batchId = req.params.batchId;
        const itemId = req.params.itemId;

        const itemResult = await query(
          `
          SELECT
            cbi.id,
            cbi.status,
            cbi.proposal_id

          FROM correction_batch_items cbi

          INNER JOIN correction_batches cb
            ON cb.id=cbi.batch_id

          WHERE cbi.id=$1
            AND cbi.batch_id=$2
            AND cb.user_id=$3
          `,
          [
            itemId,
            batchId,
            req.user.id
          ]
        );

        if (!itemResult.rowCount) {
          return res.status(404).json({
            error: 'batch_item_not_found'
          });
        }

        const item = itemResult.rows[0];

        if (
          item.status === 'published' ||
          item.status === 'approved'
        ) {
          return res.status(409).json({
            error: 'item_cannot_be_removed',
            message: 'Este artigo já foi aprovado ou publicado e não pode ser removido do lote.'
          });
        }

        await query(
          `
          DELETE FROM correction_batch_items
          WHERE id=$1
            AND batch_id=$2
          `,
          [
            itemId,
            batchId
          ]
        );

        await updateBatchCounters(query, batchId);

        res.json({
          ok: true
        });

      } catch (e) {
        next(e);
      }
    }
  );

  return router;
}
