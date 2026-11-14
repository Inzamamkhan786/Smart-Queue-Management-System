import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { asyncRoute } from '../middleware/errors.js';

const router = Router();
const nameSchema = z.object({ name: z.string().trim().min(1).max(80) });

router.param('id', (req, res, next, id) => {
  try { z.string().uuid().parse(id); next(); } catch (error) { next(error); }
});

router.get('/', asyncRoute(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT q.id, q.name, q.created_at,
      COUNT(t.id)::int AS total,
      COUNT(t.id) FILTER (WHERE t.status = 'WAITING')::int AS waiting,
      COUNT(t.id) FILTER (WHERE t.status = 'SERVING')::int AS serving,
      COUNT(t.id) FILTER (WHERE t.status = 'COMPLETED')::int AS completed,
      COUNT(t.id) FILTER (WHERE t.status = 'CANCELLED')::int AS cancelled
     FROM queues q LEFT JOIN tokens t ON t.queue_id = q.id
     WHERE q.manager_id = $1 GROUP BY q.id ORDER BY q.created_at DESC`,
    [req.manager.id]
  );
  res.json({ queues: rows });
}));

router.post('/', asyncRoute(async (req, res) => {
  const { name } = nameSchema.parse(req.body);
  const { rows } = await pool.query(
    'INSERT INTO queues (manager_id, name) VALUES ($1, $2) RETURNING id, name, created_at',
    [req.manager.id, name]
  );
  res.status(201).json({ queue: rows[0] });
}));

router.get('/:id', asyncRoute(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT q.id, q.name, q.created_at,
      COUNT(t.id)::int AS total,
      COUNT(t.id) FILTER (WHERE t.status = 'WAITING')::int AS waiting,
      COUNT(t.id) FILTER (WHERE t.status = 'SERVING')::int AS serving,
      COUNT(t.id) FILTER (WHERE t.status = 'COMPLETED')::int AS completed,
      COUNT(t.id) FILTER (WHERE t.status = 'CANCELLED')::int AS cancelled
     FROM queues q LEFT JOIN tokens t ON t.queue_id = q.id
     WHERE q.id = $1 AND q.manager_id = $2 GROUP BY q.id`,
    [req.params.id, req.manager.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Queue not found.' });
  res.json({ queue: rows[0] });
}));

router.put('/:id', asyncRoute(async (req, res) => {
  const { name } = nameSchema.parse(req.body);
  const { rows } = await pool.query(
    'UPDATE queues SET name = $1 WHERE id = $2 AND manager_id = $3 RETURNING id, name, created_at',
    [name, req.params.id, req.manager.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Queue not found.' });
  res.json({ queue: rows[0] });
}));

router.delete('/:id', asyncRoute(async (req, res) => {
  const result = await pool.query('DELETE FROM queues WHERE id = $1 AND manager_id = $2', [
    req.params.id, req.manager.id
  ]);
  if (!result.rowCount) return res.status(404).json({ error: 'Queue not found.' });
  res.status(204).end();
}));

export default router;
