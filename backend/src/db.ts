import 'dotenv/config';
import { Pool } from 'pg';

export const pool = new Pool({
  connectionString:
    process.env.TEST_DATABASE_URL ||
    process.env.DATABASE_URL ||
    'postgres://localhost:5432/lab_checkout_dev',
  max: 10
});

export async function query(text: string, params: any[] = []) {
  const result = await pool.query(text, params);
  return result.rows;
}

export async function closePool() {
  await pool.end();
}
