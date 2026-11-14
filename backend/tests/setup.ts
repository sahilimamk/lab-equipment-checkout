import fs from 'fs';
import path from 'path';
import { pool, query } from '../src/db';

// Safety guard: setup.ts TRUNCATEs every table in beforeEach. Refuse to
// run unless we are pointed at the test database, so a missing
// TEST_DATABASE_URL can never wipe the dev database.
const connStr =
  process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || '';
if (!connStr.includes('lab_checkout_test')) {
  throw new Error(
    'Refusing to run tests: TEST_DATABASE_URL must point at lab_checkout_test ' +
      `(got: ${connStr.replace(/:[^:@/]+@/, ':***@') || '(unset)'})`
  );
}

// Runs once before all tests: apply the migration + seed on the TEST database.
// Set TEST_DATABASE_URL (or DATABASE_URL) to postgres://localhost:5432/lab_checkout_test
beforeAll(async () => {
  const migration = fs.readFileSync(
    path.join(__dirname, '../db/migrations/001_init.sql'),
    'utf8'
  );
  await pool.query(migration);
  const seed = fs.readFileSync(path.join(__dirname, '../db/seeds/seed.sql'), 'utf8');
  await pool.query(seed);
});

// Clean slate between tests — fastest correct reset for a small schema.
beforeEach(async () => {
  await query('TRUNCATE checkouts, equipment, users RESTART IDENTITY CASCADE');
  const seed = fs.readFileSync(path.join(__dirname, '../db/seeds/seed.sql'), 'utf8');
  await pool.query(seed);
});

afterAll(async () => {
  await pool.end();
});
