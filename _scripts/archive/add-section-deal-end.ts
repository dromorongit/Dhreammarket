import { Pool } from 'pg'

async function addSectionDealEndColumn() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 1,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    ssl: { rejectUnauthorized: false },
  })

  try {
    console.log('Adding dealEndsAt column to homepage_section_products table...')

    await pool.query(`
      ALTER TABLE homepage_section_products 
      ADD COLUMN IF NOT EXISTS "dealEndsAt" TIMESTAMP;
    `)
    console.log('✓ Added dealEndsAt column')
    console.log('Successfully added section deal end column')
  } catch (error) {
    console.error('Error adding section deal end column:', error)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

addSectionDealEndColumn()
