import 'dotenv/config';
import { Pool, PoolClient } from 'pg';

if (!process.env.DATABASE_URL && process.env.NODE_ENV !== 'test') {
  // Friendly error instead of a cryptic pg failure.
  console.warn('[db] DATABASE_URL is not set — defaulting to postgres://localhost:5432/lab_checkout_dev');
}

export const pool = new Pool({
  connectionString:
    process.env.TEST_DATABASE_URL ||
    process.env.DATABASE_URL ||
    'postgres://localhost:5432/lab_checkout_dev',
  max: 10
});

export async function query<T = any>(text: string, params: any[] = []): Promise<T[]> {
  const { rows } = await pool.query(text, params);
  return rows as T[];
}

/** Run fn inside a transaction. Rolls back on any throw. */
export async function withTx<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Never let a failed ROLLBACK mask the original error.
    }
    throw err;
  } finally {
    client.release();
  }
}

export async function closePool(): Promise<void> {
  await pool.end();
}
