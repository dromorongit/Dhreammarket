import 'dotenv/config';
import pg from 'pg';

const { Client } = pg;

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

await client.connect();

const result = await client.query("SELECT count(*) FROM stores WHERE name = 'My Store';");
console.log('Stores with default name:', result.rows[0].count);

await client.end();
