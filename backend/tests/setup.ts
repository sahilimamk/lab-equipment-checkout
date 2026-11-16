import fs from 'fs';
import path from 'path';
import { pool, query } from '../src/db';

const connStr = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || '';
if (!connStr.includes('lab_checkout_test')) {
  throw new Error('Refusing to run tests: TEST_DATABASE_URL must point at lab_checkout_test');
}

beforeAll(async () => {
  const migration = fs.readFileSync(path.join(__dirname, '../db/migrations/001_init.sql'), 'utf8');
  await pool.query(migration);
  const seed = fs.readFileSync(path.join(__dirname, '../db/seeds/seed.sql'), 'utf8');
  await pool.query(seed);
});

beforeEach(async () => {
  await query('TRUNCATE checkouts, equipment, users RESTART IDENTITY CASCADE');
  const seed = fs.readFileSync(path.join(__dirname, '../db/seeds/seed.sql'), 'utf8');
  await pool.query(seed);
});

afterAll(async () => {
  await pool.end();
});
