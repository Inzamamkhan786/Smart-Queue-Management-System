import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { asyncRoute } from '../middleware/errors.js';

const router = Router();
const params = z.object({ days: z.coerce.number().int().min(1).max(30).default(7), queueId: z.string().uuid().optional() });

router.param('id', (req, res, next, id) => {
  try { z.string().uuid().parse(id); next(); } catch (error) { next(error); }
});

async function filterQueue(managerId, queueId) {
  if (!queueId) return null;
  const { rowCount } = await pool.query('SELECT 1 FROM queues WHERE id = $1 AND manager_id = $2', [queueId, managerId]);
  return rowCount ? queueId : false;
}

router.get('/overview', asyncRoute(async (req, res) => {
  const selected = params.parse(req.query);
  const queueId = await filterQueue(req.manager.id, selected.queueId);
  if (queueId === false) return res.status(404).json({ error: 'Queue not found.' });
  const { rows } = await pool.query(
    `WITH owned AS (
       SELECT id FROM queues WHERE manager_id = $1 AND ($2::uuid IS NULL OR id = $2)
     ), counts AS (
       SELECT COUNT(*) FILTER (WHERE status = 'WAITING')::int AS waiting,
         COUNT(*) FILTER (WHERE status = 'SERVING')::int AS serving,
         COUNT(*)::int AS total_tokens,
         AVG(EXTRACT(EPOCH FROM (service_started_at - created_at))) FILTER
           (WHERE service_started_at IS NOT NULL AND service_started_at >= NOW() - ($3 * INTERVAL '1 day'))::int
           AS average_wait_seconds
       FROM tokens WHERE queue_id IN (SELECT id FROM owned)
     )
     SELECT (SELECT COUNT(*)::int FROM owned) AS total_queues, counts.*,
       (SELECT COUNT(*)::int FROM tokens WHERE queue_id IN (SELECT id FROM owned)
         AND status = 'COMPLETED' AND completed_at >= CURRENT_DATE) AS completed_today,
       (SELECT COUNT(*)::int FROM tokens WHERE queue_id IN (SELECT id FROM owned)
         AND status = 'CANCELLED' AND cancelled_at >= CURRENT_DATE) AS cancelled_today
     FROM counts`,
    [req.manager.id, queueId, selected.days]
  );
  res.json({ overview: rows[0] });
}));

router.get('/trends', asyncRoute(async (req, res) => {
  const selected = params.parse(req.query);
  const queueId = await filterQueue(req.manager.id, selected.queueId);
  if (queueId === false) return res.status(404).json({ error: 'Queue not found.' });
  const { rows } = await pool.query(
    `WITH owned AS (SELECT id FROM queues WHERE manager_id = $1 AND ($2::uuid IS NULL OR id = $2)),
     days AS (SELECT generate_series(CURRENT_DATE - ($3::int - 1), CURRENT_DATE, '1 day')::date AS day)
     SELECT days.day,
       (SELECT COUNT(*)::int FROM tokens t WHERE t.queue_id IN (SELECT id FROM owned)
         AND t.created_at >= days.day AND t.created_at < days.day + INTERVAL '1 day') AS volume,
       (SELECT COUNT(*)::int FROM tokens t WHERE t.queue_id IN (SELECT id FROM owned)
         AND t.created_at < days.day + INTERVAL '1 day'
         AND (t.service_started_at IS NULL OR t.service_started_at >= days.day + INTERVAL '1 day')
         AND (t.cancelled_at IS NULL OR t.cancelled_at >= days.day + INTERVAL '1 day')) AS waiting,
       (SELECT ROUND(AVG(EXTRACT(EPOCH FROM (t.service_started_at - t.created_at))))::int
         FROM tokens t WHERE t.queue_id IN (SELECT id FROM owned)
         AND t.service_started_at >= days.day AND t.service_started_at < days.day + INTERVAL '1 day') AS average_wait_seconds
     FROM days ORDER BY days.day`,
    [req.manager.id, queueId, selected.days]
  );
  const distribution = await pool.query(
    `SELECT status, COUNT(*)::int AS count FROM tokens
     WHERE queue_id IN (SELECT id FROM queues WHERE manager_id = $1 AND ($2::uuid IS NULL OR id = $2))
     GROUP BY status`,
    [req.manager.id, queueId]
  );
  res.json({ trends: rows, distribution: distribution.rows });
}));

router.get('/queues/:id', asyncRoute(async (req, res) => {
  const queueId = await filterQueue(req.manager.id, req.params.id);
  if (!queueId) return res.status(404).json({ error: 'Queue not found.' });
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS total_tokens,
      COUNT(*) FILTER (WHERE status = 'WAITING')::int AS waiting,
      COUNT(*) FILTER (WHERE status = 'SERVING')::int AS serving,
      COUNT(*) FILTER (WHERE status = 'COMPLETED')::int AS completed,
      COUNT(*) FILTER (WHERE status = 'CANCELLED')::int AS cancelled,
      AVG(EXTRACT(EPOCH FROM (service_started_at - created_at)))
        FILTER (WHERE service_started_at IS NOT NULL)::int AS average_wait_seconds
     FROM tokens WHERE queue_id = $1`,
    [queueId]
  );
  res.json({ analytics: rows[0] });
}));

export default router;
