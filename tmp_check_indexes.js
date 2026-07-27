const { Client } = require('pg');

const connectionString = 'postgresql://postgres:JbSCjrHdsggoCZuAgloKppWqbbWFtVJG@nozomi.proxy.rlwy.net:12087/railway?sslmode=no-verify';

async function main() {
  const client = new Client({ connectionString });
  await client.connect();
  
  try {
    const result = await client.query("SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'wishlist_items';");
    console.log(JSON.stringify(result.rows, null, 2));
  } catch (err) {
    console.error('Query failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
