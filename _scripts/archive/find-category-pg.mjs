import 'dotenv/config';
import pg from 'pg';

const { Client } = pg;

console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'loaded' : 'NOT LOADED');

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

await client.connect();

const result = await client.query(`
  SELECT id, name, slug FROM product_categories 
  WHERE name = 'Fridges and Freezers' 
     OR slug = 'fridges-freezers' 
     OR name LIKE '%Fridge%'
  LIMIT 10
`);

console.log('Categories found:');
console.table(result.rows);

await client.end();
