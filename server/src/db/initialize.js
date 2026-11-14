import { readFile } from 'node:fs/promises';
import { pool } from './pool.js';

export async function initializeSchema() {
  const schema = await readFile(new URL('./schema.sql', import.meta.url), 'utf8');
  await pool.query(schema);
}
