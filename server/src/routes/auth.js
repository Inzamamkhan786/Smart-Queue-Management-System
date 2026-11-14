import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { requireAuth, cookieOptions } from '../middleware/auth.js';
import { asyncRoute } from '../middleware/errors.js';

const router = Router();
const credentials = z.object({
  email: z.string().email().max(254).transform((value) => value.toLowerCase().trim()),
  password: z.string().min(8).max(72)
});
const registration = credentials.extend({ name: z.string().trim().min(2).max(100) });

function setSession(res, manager) {
  const token = jwt.sign(
    { id: manager.id, name: manager.name, email: manager.email },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
  res.cookie('queueflow_session', token, cookieOptions());
}

router.post('/register', asyncRoute(async (req, res) => {
  const input = registration.parse(req.body);
  const passwordHash = await bcrypt.hash(input.password, 12);
  const { rows } = await pool.query(
    `INSERT INTO managers (name, email, password_hash) VALUES ($1, $2, $3)
     RETURNING id, name, email, created_at`,
    [input.name, input.email, passwordHash]
  );
  setSession(res, rows[0]);
  res.status(201).json({ manager: rows[0] });
}));

router.post('/login', asyncRoute(async (req, res) => {
  const input = credentials.parse(req.body);
  const { rows } = await pool.query('SELECT * FROM managers WHERE email = $1', [input.email]);
  if (!rows[0] || !(await bcrypt.compare(input.password, rows[0].password_hash))) {
    return res.status(401).json({ error: 'Email or password is incorrect.' });
  }
  const manager = { id: rows[0].id, name: rows[0].name, email: rows[0].email };
  setSession(res, manager);
  res.json({ manager });
}));

router.get('/me', requireAuth, (req, res) => res.json({ manager: req.manager }));
router.post('/logout', (req, res) => {
  res.clearCookie('queueflow_session', { ...cookieOptions(), maxAge: undefined });
  res.status(204).end();
});

router.patch('/me', requireAuth, asyncRoute(async (req, res) => {
  const input = z.object({ name: z.string().trim().min(2).max(100) }).parse(req.body);
  const { rows } = await pool.query(
    'UPDATE managers SET name = $1 WHERE id = $2 RETURNING id, name, email, created_at',
    [input.name, req.manager.id]
  );
  setSession(res, rows[0]);
  res.json({ manager: rows[0] });
}));

export default router;
