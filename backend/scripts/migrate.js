require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const dir = path.join(__dirname, '../db/migrations');
  const files = fs.readdirSync(dir).sort();
  for (const file of files) {
    console.log('Applying', file);
    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    await client.query(sql);
  }
  await client.end();
  console.log('Migrations done.');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
