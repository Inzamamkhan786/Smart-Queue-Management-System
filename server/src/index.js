import './config/env.js';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import authRoutes from './routes/auth.js';
import queueRoutes from './routes/queues.js';
import tokenRoutes from './routes/tokens.js';
import analyticsRoutes from './routes/analytics.js';
import { requireAuth } from './middleware/auth.js';
import { errorHandler, notFound } from './middleware/errors.js';
import { initializeSchema } from './db/initialize.js';
import { pool } from './db/pool.js';

if (!process.env.DATABASE_URL || !process.env.JWT_SECRET) {
  throw new Error('DATABASE_URL and JWT_SECRET must be set.');
}

try {
  await initializeSchema();
  console.log('Database schema is ready.');
} catch (error) {
  console.error('Database initialization failed:', error.message);
  await pool.end();
  process.exit(1);
}

const app = express();
app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '20kb' }));
app.use(cookieParser());
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 50 }), authRoutes);
app.use('/api/queues', requireAuth, queueRoutes);
app.use('/api', requireAuth, tokenRoutes);
app.use('/api/analytics', requireAuth, analyticsRoutes);
app.use(notFound);
app.use(errorHandler);

const server = app.listen(process.env.PORT || 4000, () => {
  console.log(`QueueFlow API listening on port ${process.env.PORT || 4000}`);
});

function shutdown() {
  server.close(() => process.exit(0));
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
