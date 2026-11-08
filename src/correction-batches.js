import express from 'express';
import { query } from './db.js';

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
 * - manter histórico organizado;
 *
 * IMPORTANTE:
 * Este arquivo NÃO publica nada no Blogger.
 *
 * A publicação continuará dependendo de aprovação explícita.
 * ============================================================
 */

export function createCorrectionBatchesRouter({
  currentUser,
  requireCsrf
}) {
  const router = express.Router();


  /*
   * ============================================================
   * CRIAR NOVO LOTE
   * POST /api/correction-batches
   *
   * Body:
   *
   * {
   *   "blogId": 1,
   *   "name": "Lote #001"
   * }
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

        /*
         * Confirma que o blog pertence ao usuário logado.
         */

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

        /*
         * Cria o lote.
         */

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

        const params = [
          req.user.id
        ];

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
   *
   * Retorna:
   *
   * - informações do lote;
   * - artigos pertencentes ao lote;
   * - status de cada artigo;
   * - proposta associada;
   * - HTML original;
   * - HTML corrigido.
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
          [
            batchId
          ]
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
   *
   * Body:
   *
   * {
   *   "postIds": [1, 2, 3]
   * }
   *
   * Os artigos precisam pertencer ao mesmo blog do lote.
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

        /*
         * Remove duplicados e converte para números.
         */

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

        /*
         * Confirma que o lote pertence ao usuário.
         */

        const batchResult = await query(
          `
          SELECT
            id,
            blog_id
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

        /*
         * Confirma que todos os artigos pertencem:
         *
         * - ao usuário;
         * - ao blog do lote.
         */

        const postsResult = await query(
          `
          SELECT
            id,
            title,
            url,
            content_html
          FROM posts
          WHERE id = ANY($1::bigint[])
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

        /*
         * Adiciona cada artigo ao lote.
         *
         * ON CONFLICT impede duplicação dentro do mesmo lote.
         */

        for (const post of postsResult.rows) {
          await query(
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
            `,
            [
              batchId,
              post.id,
              post.content_html || ''
            ]
          );
        }

        /*
         * Atualiza os contadores do lote.
         */

        await query(
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
          [
            batchId
          ]
        );

        res.json({
          ok: true,
          added: postsResult.rowCount
        });

      } catch (e) {
        next(e);
      }
    }
  );


  /*
   * ============================================================
   * REMOVER UM ARTIGO DO LOTE
   *
   * Só pode remover se ainda não houver publicação associada.
   *
   * DELETE /api/correction-batches/:batchId/items/:itemId
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
            cbi.status

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

        if (item.status === 'published') {
          return res.status(409).json({
            error: 'published_item_cannot_be_removed'
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

        /*
         * Recalcula os contadores.
         */

        await query(
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
          [
            batchId
          ]
        );

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
