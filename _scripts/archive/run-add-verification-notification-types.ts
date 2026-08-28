import { Pool } from 'pg'
require('dotenv').config({ path: '.env' })

const SQL_STATEMENTS = [
  `ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'VERIFICATION_APPROVED'`,
  `ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'VERIFICATION_REJECTED'`,
  `ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'VERIFICATION_CHANGES_REQUESTED'`,
  `ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'VERIFICATION_REVOKED'`,
  `ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'VERIFICATION_SUBMITTED'`,
]

async function addVerificationNotificationTypes() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 1,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    ssl: { rejectUnauthorized: false },
  })

  try {
    for (let i = 0; i < SQL_STATEMENTS.length; i++) {
      const sql = SQL_STATEMENTS[i]
      console.log(`\n[${i + 1}/${SQL_STATEMENTS.length}] Executing: ${sql}`)
      await pool.query(sql)
      console.log(`  → Success`)
    }

    console.log('\nAll ALTER TYPE statements executed successfully.')
  } catch (error) {
    console.error('Error adding notification type enum values:', error)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

addVerificationNotificationTypes()
