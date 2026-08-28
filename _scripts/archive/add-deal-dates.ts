import { Pool } from 'pg'

async function addDealDatesColumns() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 1,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    ssl: { rejectUnauthorized: false },
  })

  try {
    console.log('Adding dealsStart and dealsEnd columns to products table...')

    await pool.query(`
      ALTER TABLE products 
      ADD COLUMN IF NOT EXISTS "dealsStart" TIMESTAMP;
    `)
    console.log('✓ Added dealsStart column')

    await pool.query(`
      ALTER TABLE products 
      ADD COLUMN IF NOT EXISTS "dealsEnd" TIMESTAMP;
    `)
    console.log('✓ Added dealsEnd column')

    console.log('Successfully added deal date columns')
  } catch (error) {
    console.error('Error adding deal date columns:', error)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

addDealDatesColumns()
