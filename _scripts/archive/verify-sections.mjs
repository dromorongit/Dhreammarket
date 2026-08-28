import 'dotenv/config';
import pg from 'pg';

const { Client } = pg;

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

await client.connect();

// 1. Count total sections
const countResult = await client.query('SELECT COUNT(*) as count FROM homepage_sections WHERE "isEnabled" = true');
console.log(`Total enabled homepage sections: ${countResult.rows[0].count}`);

// 2. List all sections with displayOrder
const sectionsResult = await client.query('SELECT slug, name, type, "displayOrder" FROM homepage_sections WHERE "isEnabled" = true ORDER BY "displayOrder" ASC');
console.log('\nAll sections:');
console.table(sectionsResult.rows);

// 3. Spot-check fridges-freezers products
const fridgesResult = await client.query(`
  SELECT p.id, p.name, p.price, p.stock 
  FROM products p
  JOIN homepage_sections hs ON hs.slug = 'fridges-freezers'
  WHERE p."categoryId" = $1
    AND (p.stock > 0 OR p."availabilityType" IN ('IN_STOCK', 'PREORDER', 'BACKORDER'))
  LIMIT 5
`, ['cmsx0p7h300071kqs0zfgxece']);

console.log('\nFridges & Freezers products (category-based query):');
console.table(fridgesResult.rows);

// 4. Spot-check mobile-phones products
const mobileResult = await client.query(`
  SELECT p.id, p.name, p.price, p.stock 
  FROM products p
  WHERE p."categoryId" = $1
    AND (p.stock > 0 OR p."availabilityType" IN ('IN_STOCK', 'PREORDER', 'BACKORDER'))
  LIMIT 5
`, ['cmqhci126004u1knoz6327n3r']);

console.log('\nMobile Phones products (category-based query):');
console.table(mobileResult.rows);

await client.end();
