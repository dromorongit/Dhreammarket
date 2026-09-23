const { Pool } = require('pg')

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:JbSCjrHdsggoCZuAgloKppWqbbWFtVJG@nozomi.proxy.rlwy.net:12087/railway?sslmode=no-verify'
})

async function main() {
  const client = await pool.connect()
  try {
    await client.query('ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS price Float')
    console.log('Added price column to product_variants')
  } finally {
    client.release()
    await pool.end()
  }
}

main()
  .catch(e => {
    console.error('Migration failed:', e)
    process.exit(1)
  })
