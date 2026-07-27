const { Client } = require('pg');

const connectionString = 'postgresql://postgres:JbSCjrHdsggoCZuAgloKppWqbbWFtVJG@nozomi.proxy.rlwy.net:12087/railway?sslmode=no-verify';

async function main() {
  const client = new Client({ connectionString });
  await client.connect();
  
  try {
    const countResult = await client.query('SELECT COUNT(*) as total FROM wishlist_items;');
    console.log('Total wishlist_items:', countResult.rows[0].total);
    
    const productIdResult = await client.query('SELECT COUNT(*) as total FROM wishlist_items WHERE "productId" IS NOT NULL;');
    console.log('With productId:', productIdResult.rows[0].total);
    
    const distinctResult = await client.query('SELECT COUNT(DISTINCT ("wishlistId", "productId")) as distinct_count FROM wishlist_items WHERE "productId" IS NOT NULL;');
    console.log('Distinct wishlistId+productId:', distinctResult.rows[0].distinct_count);
  } catch (err) {
    console.error('Query failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
