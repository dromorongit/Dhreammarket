import 'dotenv/config';
import pg from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';

const { Client } = pg;

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

await client.connect();

const sqlFiles = [
  join(process.cwd(), '_scripts', 'add-category-products-enum.sql'),
  join(process.cwd(), '_scripts', 'add-random-products-enum.sql'),
];

for (const file of sqlFiles) {
  const sql = readFileSync(file, 'utf8').trim();
  console.log(`Executing: ${file}`);
  try {
    await client.query(sql);
    console.log('OK');
  } catch (err) {
    console.error('FAIL:', err.message);
  }
}

await client.end();
