// Applies db/migrations/*.sql in order using psql-free node pg.
// Usage: DATABASE_URL=postgres://localhost:5432/lab_checkout_dev npm run migrate
require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const dir = path.join(__dirname, '../db/migrations');
  for (const file of fs.readdirSync(dir).sort()) {
    console.log('Applying', file);
    await client.query(fs.readFileSync(path.join(dir, file), 'utf8'));
  }
  await client.end();
  console.log('Migrations done.');
})().catch((e) => { console.error(e); process.exit(1); });
