import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { asyncRoute } from '../middleware/errors.js';

const router = Router();
const tokenInput = z.object({
  personName: z.string().trim().min(1).max(100),
  phone: z.string().trim().max(30).optional().nullable()
});

router.param('id', (req, res, next, id) => {
  try { z.string().uuid().parse(id); next(); } catch (error) { next(error); }
});

async function transaction(work) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function ownedQueue(client, queueId, managerId) {
  const { rows } = await client.query(
    'SELECT id, next_token_number FROM queues WHERE id = $1 AND manager_id = $2 FOR UPDATE',
    [queueId, managerId]
  );
  return rows[0];
}

async function compactPositions(client, queueId) {
  await client.query(
    `UPDATE tokens SET position = -position
     WHERE queue_id = $1 AND status IN ('WAITING', 'SERVING')`,
    [queueId]
  );
  await client.query(
    `WITH ordered AS (
       SELECT id, ROW_NUMBER() OVER (ORDER BY ABS(position)) AS new_position
       FROM tokens WHERE queue_id = $1 AND status IN ('WAITING', 'SERVING')
     )
     UPDATE tokens t SET position = ordered.new_position
     FROM ordered WHERE t.id = ordered.id`,
    [queueId]
  );
}

router.get('/queues/:id/tokens', asyncRoute(async (req, res) => {
  const owns = await pool.query('SELECT 1 FROM queues WHERE id = $1 AND manager_id = $2', [
    req.params.id, req.manager.id
  ]);
  if (!owns.rowCount) return res.status(404).json({ error: 'Queue not found.' });
  const { rows } = await pool.query(
    `SELECT id, token_number, person_name, phone, position, status, created_at,
      service_started_at, completed_at, cancelled_at,
      CASE WHEN service_started_at IS NOT NULL
        THEN EXTRACT(EPOCH FROM (service_started_at - created_at))::int
        WHEN status = 'WAITING' THEN EXTRACT(EPOCH FROM (NOW() - created_at))::int END AS wait_seconds,
      CASE WHEN completed_at IS NOT NULL AND service_started_at IS NOT NULL
        THEN EXTRACT(EPOCH FROM (completed_at - service_started_at))::int END AS service_duration_seconds
     FROM tokens WHERE queue_id = $1
     ORDER BY CASE WHEN position IS NULL THEN 1 ELSE 0 END, position ASC, token_number DESC`,
    [req.params.id]
  );
  res.json({ tokens: rows });
}));

router.post('/queues/:id/tokens', asyncRoute(async (req, res) => {
  const input = tokenInput.parse(req.body);
  const token = await transaction(async (client) => {
    const queue = await ownedQueue(client, req.params.id, req.manager.id);
    if (!queue) return null;
    const { rows } = await client.query(
      `INSERT INTO tokens (queue_id, token_number, person_name, phone, position)
       VALUES ($1, $2, $3, $4, COALESCE(
         (SELECT MAX(position) + 1 FROM tokens WHERE queue_id = $1 AND status IN ('WAITING', 'SERVING')), 1
       ))
       RETURNING id, token_number, person_name, phone, position, status, created_at`,
      [queue.id, queue.next_token_number, input.personName, input.phone || null]
    );
    await client.query('UPDATE queues SET next_token_number = next_token_number + 1 WHERE id = $1', [queue.id]);
    return rows[0];
  });
  if (!token) return res.status(404).json({ error: 'Queue not found.' });
  res.status(201).json({ token });
}));

router.patch('/queues/:id/serve-next', asyncRoute(async (req, res) => {
  const result = await transaction(async (client) => {
    const queue = await ownedQueue(client, req.params.id, req.manager.id);
    if (!queue) return { missing: true };
    const serving = await client.query(
      "SELECT id FROM tokens WHERE queue_id = $1 AND status = 'SERVING' FOR UPDATE",
      [queue.id]
    );
    if (serving.rowCount) return { conflict: true };
    const { rows } = await client.query(
      `UPDATE tokens SET status = 'SERVING', service_started_at = NOW()
       WHERE id = (
         SELECT id FROM tokens WHERE queue_id = $1 AND status = 'WAITING'
         ORDER BY position ASC LIMIT 1 FOR UPDATE
       ) RETURNING id, token_number, person_name, phone, position, status, created_at, service_started_at`,
      [queue.id]
    );
    return { token: rows[0] };
  });
  if (result.missing) return res.status(404).json({ error: 'Queue not found.' });
  if (result.conflict) return res.status(409).json({ error: 'Complete the currently serving token first.' });
  if (!result.token) return res.status(409).json({ error: 'There are no waiting tokens.' });
  res.json({ token: result.token });
}));

router.patch('/tokens/:id/move', asyncRoute(async (req, res) => {
  const input = z.object({
    direction: z.enum(['up', 'down']).optional(),
    targetTokenId: z.string().uuid().optional(),
    placement: z.enum(['before', 'after']).optional()
  }).refine((value) => {
    const isStep = value.direction !== undefined && value.targetTokenId === undefined && value.placement === undefined;
    const isDrag = value.direction === undefined && value.targetTokenId !== undefined && value.placement !== undefined;
    return isStep || isDrag;
  }, 'Provide a direction or a target token and placement.').parse(req.body);

  const result = await transaction(async (client) => {
    const { rows } = await client.query(
      `SELECT t.queue_id FROM tokens t
       JOIN queues q ON q.id = t.queue_id
       WHERE t.id = $1 AND q.manager_id = $2`,
      [req.params.id, req.manager.id]
    );
    if (!rows[0]) return { missing: true };

    const queue = await ownedQueue(client, rows[0].queue_id, req.manager.id);
    if (!queue) return { missing: true };

    const { rows: active } = await client.query(
      `SELECT id, position, status FROM tokens
       WHERE queue_id = $1 AND status IN ('WAITING', 'SERVING')
       ORDER BY position ASC FOR UPDATE`,
      [queue.id]
    );
    const currentIndex = active.findIndex((token) => token.id === req.params.id);
    if (currentIndex === -1) return { invalid: true };
    if (active[currentIndex].status !== 'WAITING') return { invalid: true };

    const waiting = active.filter((token) => token.status === 'WAITING');
    const waitingIndex = waiting.findIndex((token) => token.id === req.params.id);
    let destination;

    if (input.direction) {
      destination = waitingIndex + (input.direction === 'up' ? -1 : 1);
      if (destination < 0 || destination >= waiting.length) return { boundary: true };
    } else {
      if (input.targetTokenId === req.params.id) return { unchanged: true };
      const targetIndex = waiting.findIndex((token) => token.id === input.targetTokenId);
      if (targetIndex === -1) return { invalidTarget: true };
      const [moved] = waiting.splice(waitingIndex, 1);
      const insertionIndex = waiting.findIndex((token) => token.id === input.targetTokenId)
        + (input.placement === 'after' ? 1 : 0);
      waiting.splice(insertionIndex, 0, moved);
      destination = waiting.findIndex((token) => token.id === req.params.id);
      if (destination === waitingIndex) return { unchanged: true };
    }

    if (input.direction) {
      [waiting[waitingIndex], waiting[destination]] = [waiting[destination], waiting[waitingIndex]];
    }

    const ordered = [...active.filter((token) => token.status === 'SERVING'), ...waiting];
    await client.query(
      `UPDATE tokens SET position = -ABS(position)
       WHERE queue_id = $1 AND status IN ('WAITING', 'SERVING')`,
      [queue.id]
    );
    for (const [index, token] of ordered.entries()) {
      await client.query('UPDATE tokens SET position = $1 WHERE id = $2', [index + 1, token.id]);
    }
    return { ok: true };
  });
  if (result.missing) return res.status(404).json({ error: 'Token not found.' });
  if (result.invalid) return res.status(409).json({ error: 'Only waiting tokens can be reordered.' });
  if (result.invalidTarget) return res.status(409).json({ error: 'Drop the token on another waiting token.' });
  if (result.boundary) return res.status(409).json({ error: 'Token is already at that end of the list.' });
  res.json({ success: true });
}));

router.patch('/tokens/:id/complete', asyncRoute(async (req, res) => {
  const result = await transaction(async (client) => {
    const { rows } = await client.query(
      `SELECT t.id, t.queue_id FROM tokens t JOIN queues q ON q.id = t.queue_id
       WHERE t.id = $1 AND q.manager_id = $2 FOR UPDATE OF q, t`,
      [req.params.id, req.manager.id]
    );
    if (!rows[0]) return { missing: true };
    const { rows: updated } = await client.query(
      `UPDATE tokens SET status = 'COMPLETED', completed_at = NOW(), position = NULL
       WHERE id = $1 AND status = 'SERVING' RETURNING id`,
      [req.params.id]
    );
    if (!updated[0]) return { invalid: true };
    await compactPositions(client, rows[0].queue_id);
    return { ok: true };
  });
  if (result.missing) return res.status(404).json({ error: 'Token not found.' });
  if (result.invalid) return res.status(409).json({ error: 'Only the currently serving token can be completed.' });
  res.json({ success: true });
}));

router.patch('/tokens/:id/cancel', asyncRoute(async (req, res) => {
  const result = await transaction(async (client) => {
    const { rows } = await client.query(
      `SELECT t.id, t.queue_id FROM tokens t JOIN queues q ON q.id = t.queue_id
       WHERE t.id = $1 AND q.manager_id = $2 FOR UPDATE OF q, t`,
      [req.params.id, req.manager.id]
    );
    if (!rows[0]) return { missing: true };
    const { rows: updated } = await client.query(
      `UPDATE tokens SET status = 'CANCELLED', cancelled_at = NOW(), position = NULL
       WHERE id = $1 AND status = 'WAITING' RETURNING id`,
      [req.params.id]
    );
    if (!updated[0]) return { invalid: true };
    await compactPositions(client, rows[0].queue_id);
    return { ok: true };
  });
  if (result.missing) return res.status(404).json({ error: 'Token not found.' });
  if (result.invalid) return res.status(409).json({ error: 'Only waiting tokens can be cancelled.' });
  res.json({ success: true });
}));

export default router;
