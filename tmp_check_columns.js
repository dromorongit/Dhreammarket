const { Client } = require('pg');

const connectionString = 'postgresql://postgres:JbSCjrHdsggoCZuAgloKppWqbbWFtVJG@nozomi.proxy.rlwy.net:12087/railway?sslmode=no-verify';

async function main() {
  const client = new Client({ connectionString });
  await client.connect();
  
  try {
    const result = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'wishlist_items' ORDER BY ordinal_position;");
    console.log(JSON.stringify(result.rows, null, 2));
  } catch (err) {
    console.error('Query failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
