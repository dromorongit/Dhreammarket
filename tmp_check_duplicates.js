const { Client } = require('pg');

const connectionString = 'postgresql://postgres:JbSCjrHdsggoCZuAgloKppWqbbWFtVJG@nozomi.proxy.rlwy.net:12087/railway?sslmode=no-verify';

async function main() {
  const client = new Client({ connectionString });
  await client.connect();
  
  try {
    const result = await client.query('SELECT "wishlistId", "serviceId", COUNT(*) FROM wishlist_items WHERE "serviceId" IS NOT NULL GROUP BY "wishlistId", "serviceId" HAVING COUNT(*) > 1;');
    console.log(JSON.stringify(result.rows, null, 2));
    if (result.rows.length === 0) {
      console.log('\nNO_DUPLICATES_FOUND');
    } else {
      console.log('\nDUPLICATES_FOUND');
    }
  } catch (err) {
    console.error('Query failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
