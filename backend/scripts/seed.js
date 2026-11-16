require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const sql = fs.readFileSync(path.join(__dirname, '../db/seeds/seed.sql'), 'utf8');
  await client.query(sql);
  await client.end();
  console.log('Seed done.');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
