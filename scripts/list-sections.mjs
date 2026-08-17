import 'dotenv/config';
import pg from 'pg';

const { Client } = pg;

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

await client.connect();

const result = await client.query('SELECT slug, name, "displayOrder" FROM homepage_sections WHERE "isEnabled" = true ORDER BY "displayOrder" ASC');

console.log('Existing sections:');
console.table(result.rows);

await client.end();
