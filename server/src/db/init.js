import '../config/env.js';
import { pool } from './pool.js';
import { initializeSchema } from './initialize.js';

try {
  await initializeSchema();
  console.log('Database schema initialized.');
} catch (error) {
  console.error('Database initialization failed:', error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
