import { Pool } from 'pg'
require('dotenv').config({ path: '.env' })

async function addStoreSetupComplete() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 1,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    ssl: { rejectUnauthorized: false },
  })

  try {
    console.log('Adding setupComplete column to stores table...')

    await pool.query(`
      ALTER TABLE stores ADD COLUMN IF NOT EXISTS "setupComplete" BOOLEAN DEFAULT FALSE;
    `)
    console.log('Added setupComplete column')

    const result = await pool.query(`
      UPDATE stores
      SET "setupComplete" = TRUE
      WHERE
        name IS NOT NULL
        AND TRIM(name) <> ''
        AND LOWER(TRIM(name)) NOT IN ('my store', 'my shop', 'untitled store', 'untitled shop', 'store', 'shop')
        AND description IS NOT NULL
        AND TRIM(description) <> ''
        AND "categoryId" IS NOT NULL
        AND "mainPhoneNumber" IS NOT NULL
        AND TRIM("mainPhoneNumber") <> ''
        AND location IS NOT NULL
        AND TRIM(location) <> '';
    `)
    console.log(`Backfilled setupComplete for ${result.rowCount} store(s)`)

    console.log('Successfully added setupComplete column to stores')
  } catch (error) {
    console.error('Error adding setupComplete column:', error)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

addStoreSetupComplete()
