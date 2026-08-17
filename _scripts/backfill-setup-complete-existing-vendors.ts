import { Pool } from 'pg'
require('dotenv').config({ path: '.env' })

async function backfillSetupComplete() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 1,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    ssl: { rejectUnauthorized: false },
  })

  try {
    console.log('Starting setupComplete backfill for pre-existing vendor stores...')

    const countResult = await pool.query('SELECT COUNT(*) FROM stores WHERE "setupComplete" = false')
    const falseCount = parseInt(countResult.rows[0].count, 10)
    console.log(`Found ${falseCount} store(s) with setupComplete = false`)

    const updateResult = await pool.query(
      'UPDATE stores SET "setupComplete" = true WHERE "setupComplete" = false'
    )
    console.log(`Backfilled setupComplete for ${updateResult.rowCount} store(s)`)

    const trueResult = await pool.query('SELECT COUNT(*) FROM stores WHERE "setupComplete" = true')
    const remainingFalseResult = await pool.query('SELECT COUNT(*) FROM stores WHERE "setupComplete" = false')
    console.log(`Verification: setupComplete = true: ${trueResult.rows[0].count}`)
    console.log(`Verification: setupComplete = false: ${remainingFalseResult.rows[0].count}`)

    console.log('Backfill completed successfully')
  } catch (error) {
    console.error('Error during backfill:', error)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

backfillSetupComplete()
